"""
SignVerse Gesture-to-NLP Translator — Phase 11
===============================================
Translates a continuous stream of skeletal joint/landmark vectors into
natural-language text using:

  1. Temporal sliding window — accumulates the last N pose frames into
     a motion context buffer.
  2. Phoneme classifier — maps joint-angle feature vectors to discrete
     ASL/ISL sign phonemes using threshold-based decision trees.
  3. Beam search decoder — resolves the phoneme lattice into the most
     probable word/phrase sequence.
  4. Streaming API — suitable for real-time sign language translation
     from live webcam or MediaPipe landmarks.

Output: TranslationResult(text, confidence, phonemes, latency_ms)
"""

from __future__ import annotations

import math
import time
from collections import deque
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Tuple


# ─────────────────────────────────────────────────────────────────────────────
# Data Structures
# ─────────────────────────────────────────────────────────────────────────────

class SignPhoneme(Enum):
    """
    Discrete gesture phoneme tokens extracted from joint geometry.
    Covers a core ASL/ISL subset used for real-time translation MVP.
    Each phoneme maps to one or more words in context.
    """
    PALM_OPEN_FORWARD   = "palm_open_fwd"
    PALM_OPEN_UP        = "palm_open_up"
    FIST_CLOSED         = "fist_closed"
    INDEX_POINT_UP      = "index_point_up"
    INDEX_POINT_FWD     = "index_point_fwd"
    TWO_FINGER_V        = "two_finger_v"
    THREE_FINGER_W      = "three_finger_w"
    THUMB_UP            = "thumb_up"
    THUMB_DOWN          = "thumb_down"
    HAND_WAVE_LEFT      = "hand_wave_left"
    HAND_WAVE_RIGHT     = "hand_wave_right"
    CROSS_WRIST         = "cross_wrist"
    CIRCLE_MOTION       = "circle_motion"
    TAP_CHEST           = "tap_chest"
    PINCH_FINGERS       = "pinch_fingers"
    UNKNOWN             = "unknown"


@dataclass
class PoseFrame:
    """
    A single temporal frame of joint/landmark data.
    Compatible with MediaPipe hand + body landmark outputs.
    """
    # Wrist joint angles in radians (roll, pitch, yaw)
    wrist_roll: float = 0.0
    wrist_pitch: float = 0.0
    wrist_yaw: float = 0.0

    # Finger extension ratio: 0.0 = fully closed, 1.0 = fully extended
    thumb_ext: float = 0.0
    index_ext: float = 0.0
    middle_ext: float = 0.0
    ring_ext: float = 0.0
    pinky_ext: float = 0.0

    # Palm normal vector (unit vector facing direction)
    palm_normal_x: float = 0.0
    palm_normal_y: float = 1.0
    palm_normal_z: float = 0.0

    # Lateral wrist velocity (for motion-based signs)
    wrist_velocity_x: float = 0.0
    wrist_velocity_y: float = 0.0

    timestamp: float = field(default_factory=time.time)


@dataclass
class PhonemeCandidate:
    """A candidate phoneme with associated confidence score."""
    phoneme: SignPhoneme
    confidence: float  # 0.0 – 1.0

    def __lt__(self, other: "PhonemeCandidate") -> bool:
        return self.confidence > other.confidence  # Higher confidence = higher priority


@dataclass
class TranslationResult:
    """Output of the Gesture-to-NLP translation pipeline."""
    text: str                          # Decoded natural language output
    confidence: float                  # Overall translation confidence
    phonemes: List[SignPhoneme]        # Ordered phoneme sequence that produced the text
    phoneme_scores: List[float]        # Per-phoneme confidence scores
    latency_ms: float                  # Total pipeline latency
    frame_count: int                   # Number of frames consumed


# ─────────────────────────────────────────────────────────────────────────────
# Phoneme Classifier
# ─────────────────────────────────────────────────────────────────────────────

class GesturePhonemeClassifier:
    """
    Rule-based phoneme classifier mapping joint geometry to discrete tokens.

    In production this would be replaced by a trained neural classifier
    (e.g., a 1D CNN or LSTM over the temporal feature window), but this
    deterministic decision tree is computationally free, fully interpretable,
    and sufficient for the ASL core vocabulary.
    """

    # Extension threshold: finger is "extended" if ratio > this value
    EXT_THRESHOLD = 0.6
    # Extension threshold: finger is "closed" if ratio < this value
    CLOSE_THRESHOLD = 0.35

    def classify(self, frame: PoseFrame) -> List[PhonemeCandidate]:
        """
        Returns a ranked list of PhonemeCandidate for a single frame.
        Multiple candidates allow downstream beam search to explore alternatives.
        """
        candidates: List[PhonemeCandidate] = []

        t = frame.thumb_ext
        i = frame.index_ext
        m = frame.middle_ext
        r = frame.ring_ext
        p = frame.pinky_ext

        ext = self.EXT_THRESHOLD
        cls = self.CLOSE_THRESHOLD

        # ── Open palm ────────────────────────────────────────────────────────
        if all(f > ext for f in (t, i, m, r, p)):
            # Distinguish palm facing forward vs. up by palm normal
            if frame.palm_normal_z > 0.6:
                candidates.append(PhonemeCandidate(SignPhoneme.PALM_OPEN_FORWARD, 0.92))
            elif frame.palm_normal_y > 0.6:
                candidates.append(PhonemeCandidate(SignPhoneme.PALM_OPEN_UP, 0.90))
            else:
                candidates.append(PhonemeCandidate(SignPhoneme.PALM_OPEN_FORWARD, 0.75))

        # ── Closed fist ───────────────────────────────────────────────────────
        elif all(f < cls for f in (i, m, r, p)) and t < 0.5:
            candidates.append(PhonemeCandidate(SignPhoneme.FIST_CLOSED, 0.93))

        # ── Thumb up / down ───────────────────────────────────────────────────
        elif t > ext and all(f < cls for f in (i, m, r, p)):
            if frame.palm_normal_y > 0.5:
                candidates.append(PhonemeCandidate(SignPhoneme.THUMB_UP, 0.91))
            elif frame.palm_normal_y < -0.5:
                candidates.append(PhonemeCandidate(SignPhoneme.THUMB_DOWN, 0.89))
            else:
                candidates.append(PhonemeCandidate(SignPhoneme.THUMB_UP, 0.70))

        # ── Index point ───────────────────────────────────────────────────────
        elif i > ext and all(f < cls for f in (m, r, p)) and t < 0.5:
            if frame.palm_normal_y > 0.4:
                candidates.append(PhonemeCandidate(SignPhoneme.INDEX_POINT_UP, 0.90))
            else:
                candidates.append(PhonemeCandidate(SignPhoneme.INDEX_POINT_FWD, 0.88))

        # ── V / Peace sign ────────────────────────────────────────────────────
        elif i > ext and m > ext and all(f < cls for f in (r, p)) and t < 0.5:
            candidates.append(PhonemeCandidate(SignPhoneme.TWO_FINGER_V, 0.91))

        # ── W / Three fingers ─────────────────────────────────────────────────
        elif i > ext and m > ext and r > ext and p < cls and t < 0.5:
            candidates.append(PhonemeCandidate(SignPhoneme.THREE_FINGER_W, 0.87))

        # ── Pinch ─────────────────────────────────────────────────────────────
        elif t > 0.3 and i > 0.3 and all(f < cls for f in (m, r, p)):
            dist = math.sqrt(
                (frame.thumb_ext - frame.index_ext) ** 2
            )
            if dist < 0.15:
                candidates.append(PhonemeCandidate(SignPhoneme.PINCH_FINGERS, 0.85))

        # ── Motion-based: waving ──────────────────────────────────────────────
        if abs(frame.wrist_velocity_x) > 0.3:
            if frame.wrist_velocity_x < -0.3:
                candidates.append(PhonemeCandidate(SignPhoneme.HAND_WAVE_LEFT, 0.80))
            else:
                candidates.append(PhonemeCandidate(SignPhoneme.HAND_WAVE_RIGHT, 0.80))

        # ── Default fallback ──────────────────────────────────────────────────
        if not candidates:
            candidates.append(PhonemeCandidate(SignPhoneme.UNKNOWN, 0.40))

        # Sort by confidence descending
        candidates.sort()
        return candidates[:3]  # Return top-3 candidates for beam search


# ─────────────────────────────────────────────────────────────────────────────
# Beam Search Decoder
# ─────────────────────────────────────────────────────────────────────────────

# Simple sign language lexicon: maps phoneme sequences → words/phrases
# In production this is a trained language model (CTC / seq2seq).
_PHONEME_LEXICON: Dict[Tuple[SignPhoneme, ...], str] = {
    (SignPhoneme.PALM_OPEN_FORWARD,):                   "HELLO",
    (SignPhoneme.HAND_WAVE_RIGHT,):                     "HI",
    (SignPhoneme.HAND_WAVE_LEFT,):                      "BYE",
    (SignPhoneme.THUMB_UP,):                            "YES",
    (SignPhoneme.THUMB_DOWN,):                          "NO",
    (SignPhoneme.INDEX_POINT_UP,):                      "UP",
    (SignPhoneme.INDEX_POINT_FWD,):                     "YOU",
    (SignPhoneme.FIST_CLOSED,):                         "STOP",
    (SignPhoneme.TWO_FINGER_V,):                        "PEACE",
    (SignPhoneme.THREE_FINGER_W,):                      "WATER",
    (SignPhoneme.PINCH_FINGERS,):                       "SMALL",
    (SignPhoneme.PALM_OPEN_UP,):                        "PLEASE",
    (SignPhoneme.CROSS_WRIST,):                         "WITH",
    (SignPhoneme.CIRCLE_MOTION,):                       "AGAIN",
    (SignPhoneme.TAP_CHEST,):                           "ME",
    # Two-sign combinations
    (SignPhoneme.INDEX_POINT_FWD, SignPhoneme.PALM_OPEN_FORWARD): "YOU HELLO",
    (SignPhoneme.TAP_CHEST, SignPhoneme.PALM_OPEN_FORWARD):       "I HELLO",
    (SignPhoneme.THUMB_UP, SignPhoneme.PALM_OPEN_FORWARD):        "GOOD",
    (SignPhoneme.FIST_CLOSED, SignPhoneme.PALM_OPEN_FORWARD):     "STOP PLEASE",
}


@dataclass
class BeamHypothesis:
    """A single hypothesis in the beam search lattice."""
    phonemes: List[SignPhoneme]
    log_prob: float  # Cumulative log-probability

    def score(self) -> float:
        """Length-normalised score for fair comparison between hypotheses."""
        n = max(1, len(self.phonemes))
        return self.log_prob / n


class BeamSearchDecoder:
    """
    Beam search over the phoneme lattice to decode sign language sentences.

    At each time step it maintains `beam_width` partial hypotheses and
    extends each by the top-K phoneme candidates from the classifier.
    """

    def __init__(self, beam_width: int = 4, max_length: int = 8):
        self.beam_width = beam_width
        self.max_length = max_length

    def decode(
        self,
        phoneme_sequences: List[List[PhonemeCandidate]],
    ) -> Tuple[List[SignPhoneme], float]:
        """
        Decode a sequence of per-frame phoneme candidates.

        Args:
            phoneme_sequences: One list of PhonemeCandidate per deduplicated
                               frame window.

        Returns:
            (best_phoneme_sequence, confidence)
        """
        # Initialise beam with empty hypothesis
        beam: List[BeamHypothesis] = [BeamHypothesis(phonemes=[], log_prob=0.0)]

        for frame_candidates in phoneme_sequences:
            new_beam: List[BeamHypothesis] = []

            for hyp in beam:
                for candidate in frame_candidates[:self.beam_width]:
                    if candidate.confidence < 0.35:
                        continue
                    log_p = math.log(max(candidate.confidence, 1e-9))
                    new_hyp = BeamHypothesis(
                        phonemes=hyp.phonemes + [candidate.phoneme],
                        log_prob=hyp.log_prob + log_p,
                    )
                    new_beam.append(new_hyp)

            # Prune to beam_width by length-normalised score
            new_beam.sort(key=lambda h: h.score(), reverse=True)
            beam = new_beam[: self.beam_width]

            # Early stop if max length reached
            if beam and len(beam[0].phonemes) >= self.max_length:
                break

        if not beam or not beam[0].phonemes:
            return [], 0.0

        best = beam[0]
        confidence = math.exp(best.score()) if best.log_prob < 0 else 0.5
        return best.phonemes, min(confidence, 1.0)

    def to_text(self, phonemes: List[SignPhoneme]) -> str:
        """
        Map a phoneme sequence to natural language text via the lexicon.
        Falls back to individual phoneme mappings if the full sequence
        has no lexicon entry.
        """
        if not phonemes:
            return ""

        # Try progressively shorter suffixes from the end of the sequence
        for length in range(min(len(phonemes), 4), 0, -1):
            for start in range(len(phonemes) - length + 1):
                key = tuple(phonemes[start: start + length])
                if key in _PHONEME_LEXICON:
                    prefix = self.to_text(phonemes[:start])
                    suffix = self.to_text(phonemes[start + length:])
                    parts = [p for p in [prefix, _PHONEME_LEXICON[key], suffix] if p]
                    return " ".join(parts)

        # Last resort: use phoneme enum names
        return " ".join(p.value.upper().replace("_", " ") for p in phonemes)


# ─────────────────────────────────────────────────────────────────────────────
# Main Translator
# ─────────────────────────────────────────────────────────────────────────────

class GestureToNLPTranslator:
    """
    End-to-end Gesture-to-NLP Translation Pipeline.

    Usage (streaming mode):
        translator = GestureToNLPTranslator(window_size=30)
        translator.ingest_frame(pose_frame)          # Call at ~30fps
        result = translator.translate()              # Call whenever needed
        print(result.text, result.confidence)

    Usage (batch mode):
        result = translator.translate_sequence(list_of_pose_frames)
    """

    def __init__(
        self,
        window_size: int = 30,
        beam_width: int = 4,
        min_confidence: float = 0.35,
        dedup_threshold: float = 0.85,
    ):
        """
        Args:
            window_size: Number of recent frames to hold in the context buffer.
            beam_width: Beam search width (more = better accuracy, slower).
            min_confidence: Minimum phoneme confidence to include in beam.
            dedup_threshold: Phoneme deduplication threshold — consecutive
                             identical phonemes above this confidence are
                             collapsed into one (prevents repetition).
        """
        self.window_size = window_size
        self.min_confidence = min_confidence
        self.dedup_threshold = dedup_threshold

        self._buffer: deque[PoseFrame] = deque(maxlen=window_size)
        self._classifier = GesturePhonemeClassifier()
        self._decoder = BeamSearchDecoder(beam_width=beam_width)

        # Statistics
        self._total_translations = 0
        self._total_latency_ms = 0.0

    # ── Streaming API ─────────────────────────────────────────────────────────

    def ingest_frame(self, frame: PoseFrame) -> None:
        """Add a single pose frame to the temporal context buffer."""
        self._buffer.append(frame)

    def translate(self) -> Optional[TranslationResult]:
        """
        Translate the current context buffer.
        Returns None if the buffer has fewer than 5 frames (insufficient context).
        """
        if len(self._buffer) < 5:
            return None
        return self.translate_sequence(list(self._buffer))

    # ── Batch API ─────────────────────────────────────────────────────────────

    def translate_sequence(self, frames: List[PoseFrame]) -> TranslationResult:
        """
        Translate a complete sequence of pose frames into natural language.

        Pipeline:
            frames → per-frame classifier → dedup → beam search → lexicon → text
        """
        t_start = time.perf_counter()

        # Step 1: Classify each frame into phoneme candidates
        raw_candidates: List[List[PhonemeCandidate]] = [
            self._classifier.classify(f) for f in frames
        ]

        # Step 2: Temporal deduplication — collapse repeated identical top phonemes
        deduped: List[List[PhonemeCandidate]] = []
        last_top: Optional[SignPhoneme] = None
        for candidates in raw_candidates:
            top = candidates[0] if candidates else None
            if top is None:
                continue
            if (
                top.phoneme != last_top
                or top.phoneme == SignPhoneme.UNKNOWN
                or top.confidence < self.dedup_threshold
            ):
                deduped.append(candidates)
                last_top = top.phoneme

        # Step 3: Beam search decode
        phonemes, beam_confidence = self._decoder.decode(deduped)

        # Step 4: Map to text
        text = self._decoder.to_text(phonemes)

        latency_ms = (time.perf_counter() - t_start) * 1000
        self._total_translations += 1
        self._total_latency_ms += latency_ms

        return TranslationResult(
            text=text if text else "[no sign detected]",
            confidence=beam_confidence,
            phonemes=phonemes,
            phoneme_scores=[c[0].confidence for c in deduped if c],
            latency_ms=latency_ms,
            frame_count=len(frames),
        )

    # ── Utilities ─────────────────────────────────────────────────────────────

    def reset(self) -> None:
        """Clear the temporal context buffer."""
        self._buffer.clear()

    def stats(self) -> Dict:
        """Return cumulative translation statistics."""
        avg_latency = (
            self._total_latency_ms / self._total_translations
            if self._total_translations > 0 else 0.0
        )
        return {
            "total_translations": self._total_translations,
            "avg_latency_ms": round(avg_latency, 2),
            "buffer_size": len(self._buffer),
            "window_size": self.window_size,
        }


# ─────────────────────────────────────────────────────────────────────────────
# Module-level singleton for convenience
# ─────────────────────────────────────────────────────────────────────────────

_default_translator = GestureToNLPTranslator(window_size=30, beam_width=4)


def translate(frames: Optional[List[PoseFrame]] = None) -> Optional[TranslationResult]:
    """
    Convenience function for quick translation.

    Args:
        frames: If provided, translate this specific sequence (batch mode).
                If None, translate the current streaming buffer.

    Returns:
        TranslationResult or None if insufficient frames.
    """
    if frames is not None:
        return _default_translator.translate_sequence(frames)
    return _default_translator.translate()


def ingest_frame(frame: PoseFrame) -> None:
    """Add a frame to the default streaming translator buffer."""
    _default_translator.ingest_frame(frame)