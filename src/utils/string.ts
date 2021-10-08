import googleTranslateApi from '@vitalets/google-translate-api';

module StringUtils {
    export function upperCaseFirstLetterWord(str: string): string {
        if (str === "") {
            return str;
        }
        let array = str.split(" ");
        array = array.filter((element) => element != undefined && element != '');
        for (let i = 0; i < array.length; i++) {
            array[i] = upperCaseFirstLetter(array[i]);
        }
        return array.join(" ");
    }
    export function upperCaseFirstLetter(str: string) {
        str = str.toLowerCase();
        return str.length > 1 ? str[0].toUpperCase() + str.substring(1) : str.toUpperCase();
    }
    export function removeMutipleSpace(str: string) {
        return str?.replace(/\s+/g, ' ');
    }
    export async function translate(text: string, to: string = 'pt', from = "auto"): Promise<string> {
        if (text == null || text == "") {
            return "";
        }
        try {
            var res = await googleTranslateApi(text.trim(), { to: to, from: from });
            return `${res.text} (${text})`.trim();
        } catch (error) {
            console.log(error);
        }
        return text;

    }
}
export = StringUtils;