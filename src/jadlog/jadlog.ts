import axios from 'axios';
import ApiResponse from '../models/api_reponse';
import { load } from 'cheerio';
import { JadLogEvent } from '../models/jadlog';
import { removeMutipleSpace, upperCaseFirstLetter, upperCaseFirstLetterWord } from '../utils/string';
import { newDateFromTimeZone } from '../utils/date';
import { parse } from 'date-fns';

const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/93.0.4577.82 Safari/537.36'
};
const baseUrl = 'https://www.jadlog.com.br/siteInstitucional/tracking_dev.jad';

module Jadlog {
    export async function jadlogApi(code: string): Promise<ApiResponse | undefined> {
        try {
            const response = await jadLogFind(code);
            if (response.length > 0) {
                response.reverse();
                const last = response[0];
                return jadlogParse(last);
            }
        } catch (error) {
            console.log(error);
        }
        return undefined;
    }
}
export = Jadlog;

function jadlogParse(tracking: JadLogEvent): ApiResponse {
    const response = new ApiResponse();
    response.locale = getLocale(tracking?.local);
    response.isFinished = tracking.status?.trim().toUpperCase() === 'ENTREGUE';
    response.status = upperCaseFirstLetter(tracking.status)?.trim();
    response.trackedAt = newDateFromTimeZone(parse(removeMutipleSpace(tracking.date?.trim()), "dd/MM/yyyy HH:mm", new Date()), -3);
    response.observation = getObservation(tracking);
    return response;
}

async function jadLogFind(code: string): Promise<JadLogEvent[]> {
    const tracking: JadLogEvent[] = [];
    try {
        const response = await axios.get(`${baseUrl}?cte=${code}`, { headers });
        const html = load(response.data);

        const data = html('#j_idt2_data tr');
        data.each((i, el) => {
            const data = html(el).find('td');
            if (data.length > 0) {
                const date = data.eq(0).text();
                const local = data.eq(1).text();
                const status = data.eq(2).text();
                const destino = data.eq(3).text();
                if (!date.trim()?.toLowerCase()?.includes('não existem dados referentes a remessa.')) {
                    tracking.push({
                        date: date,
                        local: local,
                        status: status,
                        destino: destino
                    });
                }
            }
        });
    } catch (error) {
        console.log(error);
    }

    return tracking;
}

function getObservation(tracking: JadLogEvent): string {
    if (tracking?.status.trim()?.toUpperCase() === 'ENTREGUE') {
        return 'Entrega Efetuada';
    }
    if (tracking?.status.trim()?.toUpperCase() === 'TRANSFERENCIA') {
        return `Em transferência de ${getLocale(tracking?.local)} para ${getLocale(tracking?.destino)}`;
    }
    if (tracking?.status.trim()?.toUpperCase() === 'ENTRADA') {
        return `Objeto chegou em ${getLocale(tracking?.local)}`;
    }
    if (tracking?.status.trim()?.toUpperCase() === 'EMISSAO') {
        return `Código de rastreio emitido`;
    }
    if (removeMutipleSpace(tracking?.status.trim())?.match(/TRANSFERIDO PARA/gi)) {
        return `Objeto saiu de ${getLocale(tracking?.local)} com destino ${getLocale(tracking?.destino)}`;
    }
    if (removeMutipleSpace(tracking?.status.trim()?.toUpperCase()) === 'EM ROTA') {
        return `Objeto saiu para entrega ao destinatário`
    }
    if (tracking?.local?.trim()?.toUpperCase() === tracking?.destino?.trim()?.toUpperCase()) {
        return `${upperCaseFirstLetterWord(removeMutipleSpace(tracking?.status?.trim()))}`;
    }
    return `${upperCaseFirstLetter(removeMutipleSpace(tracking?.status?.trim()))} de ${getLocale(tracking?.local)} para ${getLocale(tracking?.destino)}`;
}

function getLocale(locale: string): string {
    if (locale && locale.trim() !== "") {
        const words = locale.trim().split(' ');
        const sigla = words[0];
        locale = upperCaseFirstLetterWord(locale);
        locale = locale.replace(new RegExp(sigla, 'gi'), sigla);
        locale = locale.replace(new RegExp("JAD", 'gi'), "JAD");
        return removeMutipleSpace(locale?.trim());
    }
    return "";
}