import os
import logging
from opentelemetry._logs import set_logger_provider
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.resources import Resource

_initialized = False

def setup_logging():
    global _initialized
    if _initialized:
        return
    token = os.getenv("POSTHOG_LOGS_TOKEN", "")
    if not token:
        logging.getLogger().setLevel(logging.INFO)
        return

    resource = Resource(attributes={"service.name": "sonar-backend"})
    logger_provider = LoggerProvider(resource=resource)
    set_logger_provider(logger_provider)

    exporter = OTLPLogExporter(
        endpoint="https://us.i.posthog.com/otlp/v1/logs",
        headers={"Authorization": f"Bearer {token}"},
    )
    logger_provider.add_log_record_processor(BatchLogRecordProcessor(exporter))

    handler = LoggingHandler(logger_provider=logger_provider)
    logging.getLogger().addHandler(handler)
    logging.getLogger().setLevel(logging.INFO)
    _initialized = True
