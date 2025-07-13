// logger.ts
enum LogLevel {
    INFO,
    WARN,
    ERROR,
}

export class Logger {
    private logToConsole(level: LogLevel, message: string, details?: any) {
        // SOLUTION BRUTALE : console.log direct
        console.log(`[Nexus AI Chat Importer] [${LogLevel[level]}] ${message}`);
    }

    info(message: string, details?: any) {
        console.log(`[Nexus AI Chat Importer] [INFO] ${message}`);
    }

    warn(message: string, details?: any) {
        console.warn(`[Nexus AI Chat Importer] [WARN] ${message}`);
    }

    error(message: string, details?: any) {
        console.error(`[Nexus AI Chat Importer] [ERROR] ${message}`);
    }
}