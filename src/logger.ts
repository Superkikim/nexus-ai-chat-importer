// logger.ts
enum LogLevel {
    DEBUG,
    INFO,
    WARN,
    ERROR,
}

export class Logger {
    private logToConsole(level: LogLevel, message: string, details?: any) {
        // SOLUTION BRUTALE : console.log direct
        console.log(`[Nexus AI Chat Importer] [${LogLevel[level]}] ${message}`);
    }

    debug(message: string, details?: any) {
        // DEBUG logs are only shown in console when developer tools are open
        console.debug(`[Nexus AI Chat Importer] [DEBUG] ${message}`, details || '');
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