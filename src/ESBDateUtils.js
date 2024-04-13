/**
 * ESBDateUtils class provides utility functions to format and parse dates
 * found in HDF files (DD-MM-YYYY).
 * It is designed as a lightweight alternative to Moment.js for date formatting and parsing,
 * specifically to enhance performance in scenarios where intensive date operations are required.
 * This class includes methods to format dates into specific string formats,
 * format times, and parse date strings into Date objects.
 */
class ESBDateUtils {
    /**
     * Formats a Date object into a string with the format "DD-MM-YYYY HH:MM".
     * This method is a replacement for similar functionality in Moment.js, 
     * optimized for better performance in intensive date operations.
     * 
     * @param {Date} date - The Date object to format.
     * @returns {string} A string representing the formatted date and time.
     */
    static formatDate(date) {
        const day = `0${date.getDate()}`.slice(-2);
        const month = `0${date.getMonth() + 1}`.slice(-2);
        const year = date.getFullYear();
        const hour = `0${date.getHours()}`.slice(-2);
        const minute = `0${date.getMinutes()}`.slice(-2);

        return `${day}-${month}-${year} ${hour}:${minute}`;
    }

    /**
     * Formats a Date object into a string with the format "DD-MM-YYYY HH:MM".
     * This method is a replacement for similar functionality in Moment.js, 
     * optimized for better performance in intensive date operations.
     * 
     * @param {Date} date - The Date object to format.
     * @returns {string} A string representing the formatted date and time.
     */
    static formatTime(date) {
        const hour = `0${date.getHours()}`.slice(-2);
        const minute = `0${date.getMinutes()}`.slice(-2);

        return `${hour}:${minute}`;
    }

    /**
     * Parses a date string of the format "DD-MM-YYYY HH:MM" into a Date object.
     * This method offers a quicker alternative to Moment.js parsing,
     * which is beneficial for handling large volumes of date data.
     * 
     * @param {string} dateString - The date string to parse.
     * @returns {Date} A Date object representing the parsed date and time.
     */
    static parseDate(dateString) {
        let date, time;
        if (dateString.includes('-')) {
            // Handle "DD-MM-YYYY HH:mm" format
            [date, time] = dateString.split(' ');
            const [dd, mm, yyyy] = date.split('-').map(Number);
            const [hours, minutes] = time.split(':').map(Number);
            return new Date(yyyy, mm - 1, dd, hours, minutes);
        } else if (dateString.includes('/')) {
            // Handle "DD/MM/YYYY HH:mm" format
            [date, time] = dateString.split(' ');
            const [dd, mm, yyyy] = date.split('/').map(Number);
            const [hours, minutes] = time.split(':').map(Number);
            return new Date(yyyy, mm - 1, dd, hours, minutes);
        } else {
            throw new Error('Date string format is not recognized');
        }
    }

    /**
     * Converts a date string from "DD/MM/YYYY HH:mm" format to "DD-MM-YYYY HH:mm" format if necessary.
     * If the input string is already in "DD-MM-YYYY HH:mm" format, it returns the input as is.
     * 
     * @param {string} dateString - The date string which might be in "DD/MM/YYYY HH:mm" or "DD-MM-YYYY HH:mm" format.
     * @returns {string} A date string in "DD-MM-YYYY HH:mm" format or the original format if no conversion is needed.
     */
    static cleanupDataFormat(dateString) {
        // Check if the input is already in "DD-MM-YYYY HH:mm" format
        if (dateString.includes('-')) {
            return dateString; // Return as is because it's already in the correct format
        }

        // Convert "DD/MM/YYYY HH:mm" to "DD-MM-YYYY HH:mm"
        const [datePart, timePart] = dateString.split(' ');
        const formattedDatePart = datePart.replace(/\//g, '-');
        return `${formattedDatePart} ${timePart}`;
    }

}

export default ESBDateUtils;