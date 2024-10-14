// logger.ts
enum LogLevel {
    INFO,
    WARN,
    ERROR,
}

export class Logger {
    private logToConsole(level: LogLevel, message: string, details?: any) {
        const timestamp = new Date().toISOString();
        const logMethod =
            level === LogLevel.ERROR
                ? console.error
                : level === LogLevel.WARN
                ? console.warn
                : console.log;

        logMethod(
            `[${timestamp}] [Nexus AI Chat Importer] [${LogLevel[level]}] ${message}`,
            details
        );
    }

    info(message: string, details?: any) {
        this.logToConsole(LogLevel.INFO, message, details);
    }

    warn(message: string, details?: any) {
        this.logToConsole(LogLevel.WARN, message, details);
    }

    error(message: string, details?: any) {
        this.logToConsole(LogLevel.ERROR, message, details);
    }
}