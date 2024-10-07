// utils/date-utils.ts

import { moment } from "obsidian";

export function formatTimestamp(
    // REQUIRE REFACTORING TO SUPPORT OTHER DATE FORMATS THAN UNIXTIME
    unixTime: number,
    format: "prefix" | "date" | "time"
): string {
    const date = moment(unixTime * 1000);
    switch (format) {
        case "prefix":
            return date.format("YYYYMMDD");
        case "date":
            return date.format("L");
        case "time":
            return date.format("LT");
    }
}

export function createDatePrefix(
    timeStamp: number,
    dateFormat: string
): string {
    const date = new Date(timeStamp * 1000); // Convert Unix timestamp to Date
    let prefix = "";

    // Format the date based on the specified format
    if (dateFormat === "YYYY-MM-DD") {
        prefix = date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
    } else if (dateFormat === "YYYYMMDD") {
        prefix = date.toISOString().split("T")[0].replace(/-/g, ""); // Remove dashes for YYYYMMDD
    }

    return prefix;
}

export function generateYearMonthFolderString(unixTime: number): string {
    const date = new Date(unixTime * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}/${month}`;
}
