import { NodeSDK } from "@opentelemetry/sdk-node";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { metrics, trace } from "@opentelemetry/api";
import pino from "pino";

// ─── Logger ──────────────────────────────────────────────────────────────────

/**
 * Structured JSON logger using Pino.
 * Use this in all SignVerse microservices instead of console.log.
 */
export const createLogger = (serviceName: string) =>
  pino({
    name: serviceName,
    level: process.env.LOG_LEVEL || "info",
    transport:
      process.env.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  });

// ─── OpenTelemetry SDK Setup ─────────────────────────────────────────────────

/**
 * Initialize the OpenTelemetry SDK for a given service.
 * Exports metrics to Prometheus and traces to an OTLP collector.
 */
export function initObservability(serviceName: string) {
  const prometheusExporter = new PrometheusExporter({
    port: parseInt(process.env.OTEL_PROMETHEUS_PORT || "9464"),
  });

  const traceExporter = new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
      "http://localhost:4318/v1/traces",
  });

  const sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
    }),
    traceExporter,
    metricReader: prometheusExporter,
  });

  sdk.start();

  process.on("SIGTERM", () => {
    sdk
      .shutdown()
      .then(() => console.log("OpenTelemetry SDK shut down cleanly"))
      .catch((err) => console.error("Error shutting down OTel SDK", err))
      .finally(() => process.exit(0));
  });

  return { sdk, metrics, trace };
}

// ─── AI Monitoring ───────────────────────────────────────────────────────────

/**
 * Dedicated AI monitoring logger.
 * Emits structured events for inference quality, drift, and hallucinations.
 */
export class AIMonitor {
  private logger: ReturnType<typeof createLogger>;
  private meter = metrics.getMeter("signverse.ai");

  private inferenceCounter = this.meter.createCounter(
    "signverse_ai_inference_total",
    { description: "Total AI inference calls" }
  );
  private latencyHistogram = this.meter.createHistogram(
    "signverse_ai_inference_latency_ms",
    { description: "AI inference latency in milliseconds" }
  );
  private confidenceGauge = this.meter.createObservableGauge(
    "signverse_ai_confidence_score",
    { description: "Last recorded AI confidence score (0-1)" }
  );

  private lastConfidence = 1.0;

  constructor(serviceName: string) {
    this.logger = createLogger(`ai-monitor:${serviceName}`);
    this.confidenceGauge.addCallback((obs) => {
      obs.observe(this.lastConfidence);
    });
  }

  /**
   * Record a completed inference event.
   */
  recordInference(opts: {
    modelId: string;
    latencyMs: number;
    confidence: number;
    inputType: "vision" | "gesture" | "audio" | "multimodal";
  }) {
    this.inferenceCounter.add(1, {
      model: opts.modelId,
      input_type: opts.inputType,
    });
    this.latencyHistogram.record(opts.latencyMs, { model: opts.modelId });
    this.lastConfidence = opts.confidence;

    if (opts.latencyMs > 200) {
      this.logger.warn(
        { ...opts },
        "AI inference latency exceeded 200ms threshold"
      );
    }

    if (opts.confidence < 0.6) {
      this.detectDrift(opts.modelId, opts.confidence);
    }
  }

  /**
   * Flag a potential model drift condition.
   */
  detectDrift(modelId: string, confidence: number) {
    this.logger.error(
      { modelId, confidence, event: "model_drift_detected" },
      `ALERT: Model drift detected on ${modelId}. Confidence dropped to ${confidence.toFixed(3)}`
    );
  }

  /**
   * Flag a suspected AI hallucination.
   */
  flagHallucination(opts: {
    modelId: string;
    input: string;
    output: string;
    reason: string;
  }) {
    this.logger.error(
      { ...opts, event: "hallucination_detected" },
      `ALERT: Hallucination detected from ${opts.modelId}. Reason: ${opts.reason}`
    );
  }
}

export { metrics, trace };
