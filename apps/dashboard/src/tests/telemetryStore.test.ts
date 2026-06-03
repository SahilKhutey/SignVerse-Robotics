import { describe, it, expect, beforeEach } from 'vitest';
import { useTelemetryStore } from '../store/telemetry';
import { TelemetryFrame } from '@signverse/shared-types';

describe('useTelemetryStore', () => {
  beforeEach(() => {
    // Reset state before each test
    useTelemetryStore.setState({
      frame: null,
      wsState: 'IDLE',
      hz: 0,
      activeRobotId: 'signverse-robot-01',
      connectedRobots: ['signverse-robot-01', 'signverse-robot-02'],
      isRecording: false,
      recordedFrames: [],
      sessionLabel: '',
      isPlaying: false,
      playbackIndex: 0,
      playbackRate: 1.0,
      isEstopTriggered: false,
      isTwinFrozen: false,
    });
  });

  it('should update wsState', () => {
    useTelemetryStore.getState().setWsState('LIVE');
    expect(useTelemetryStore.getState().wsState).toBe('LIVE');
  });

  it('should update active robot id', () => {
    useTelemetryStore.getState().setActiveRobot('signverse-robot-02');
    expect(useTelemetryStore.getState().activeRobotId).toBe('signverse-robot-02');
  });

  it('should set frame and record it when recording is active', () => {
    const testFrame: TelemetryFrame = {
      jointAngles: [0.1, 0.2, 0.3, 0, 0, 0, 0],
      poseLandmarks: [],
      aiPrediction: [0, 0, 0, 0, 0, 0, 0],
      confidence: 0.9,
      timestampMs: 123456,
    };

    // Before recording
    useTelemetryStore.getState().setFrame(testFrame);
    expect(useTelemetryStore.getState().frame).toEqual(testFrame);
    expect(useTelemetryStore.getState().recordedFrames.length).toBe(0);

    // Start recording
    useTelemetryStore.getState().startRecording('test_record');
    expect(useTelemetryStore.getState().isRecording).toBe(true);
    expect(useTelemetryStore.getState().sessionLabel).toBe('test_record');

    // Push frame during recording
    useTelemetryStore.getState().setFrame(testFrame);
    expect(useTelemetryStore.getState().recordedFrames).toEqual([testFrame]);

    // Stop recording
    useTelemetryStore.getState().stopRecording();
    expect(useTelemetryStore.getState().isRecording).toBe(false);
  });

  it('should trigger E-Stop and force frame confidence to zero', () => {
    const testFrame: TelemetryFrame = {
      jointAngles: [0.1, 0.2, 0.3, 0, 0, 0, 0],
      poseLandmarks: [],
      aiPrediction: [0, 0, 0, 0, 0, 0, 0],
      confidence: 0.9,
      timestampMs: 123456,
    };

    useTelemetryStore.getState().setFrame(testFrame);
    
    // Trigger E-Stop
    useTelemetryStore.getState().setEstop(true);
    expect(useTelemetryStore.getState().isEstopTriggered).toBe(true);
    expect(useTelemetryStore.getState().frame?.confidence).toBe(0);

    // Reset E-Stop
    useTelemetryStore.getState().setEstop(false);
    expect(useTelemetryStore.getState().isEstopTriggered).toBe(false);
  });

  it('should toggle playing state and change playback variables', () => {
    useTelemetryStore.getState().setIsPlaying(true);
    expect(useTelemetryStore.getState().isPlaying).toBe(true);

    useTelemetryStore.getState().setPlaybackIndex(50);
    expect(useTelemetryStore.getState().playbackIndex).toBe(50);

    useTelemetryStore.getState().setPlaybackRate(2.0);
    expect(useTelemetryStore.getState().playbackRate).toBe(2.0);
  });
});
