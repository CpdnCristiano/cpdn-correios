module DateUtils {
    export function newDateFromTimeZone(time: string | Date, timeZone: number): Date {
        const date = typeof time === "string" ? new Date(time) : time;
        date.setHours(date.getHours() - timeZone);
        const result = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()));
        return result;
    }
}
export = DateUtils;