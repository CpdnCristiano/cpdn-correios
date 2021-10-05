import axios from 'axios';
import { parse } from 'date-fns';
import { env } from 'process';
import express from "express";
import cheerioModule from 'cheerio';
import googleTranslateApi from '@vitalets/google-translate-api';
import { getAllCountries, getCountry, getTimezonesForCountry } from 'countries-and-timezones';
import ApiResponse from './models/api_reponse';
import { jadlogApi } from './jadlog/jadlog';
import { newDateFromTimeZone } from './utils/date';
import { upperCaseFirstLetterWord } from './utils/string';

const caniaoCode = /^[a-z]{2}\d{14}$/i
const correiosCode = /[a-z]{2}\d{9}[a-z]{2}/i;
const jadlogCode = /^\d{14}$/i;
declare module CorreiosAPI {
    export interface Recebedor {
        nome: string;
        documento: string;
        comentario: string;
    }

    export interface Endereco {
        codigo: string;
        cep: string;
        logradouro: string;
        numero: string;
        localidade: string;
        uf: string;
        bairro: string;
        latitude: string;
        longitude: string;
    }

    export interface Unidade {
        local: string;
        codigo: string;
        cidade: string;
        bairro: String;
        uf: string;
        sto: string;
        tipounidade: string;
        endereco: Endereco;
    }

    export interface Evento {
        tipo: string;
        status: string;
        data: string;
        hora: string;
        criacao?: string;
        descricao: string;
        recebedor?: Recebedor;
        unidade: Unidade;
        cepDestino?: string;
        prazoGuarda?: string;
        dataPostagem?: string;
        detalhe?: string;
        destino: Unidade[];
    }

    export interface Objeto {
        numero: string;
        sigla: string;
        nome: string;
        categoria: string;
        evento: Evento[];
    }
    interface CorreiosAPITrackingResponse {
        versao: string;
        quantidade: string;
        pesquisa: string;
        resultado: string;
        objeto: Objeto[];
    }

}
declare module CainiaoApi {

    export interface LatestTrackingInfo {
        desc: string;
        status: string;
        time: string;
        timeZone: string;
    }

    export interface Detail {
        desc: string;
        status: string;
        time: string;
        timeZone: string;
    }

    export interface Section {
        companyName: string;
        companyPhone: string;
        countryName: string;
        detailList: Detail[];
        url: string;
        mailNo: string;
    }

    export interface Datum {
        allowRetry: boolean;
        bizType: string;
        cachedTime: string;
        destCountry: string;
        destCpList: any[];
        hasRefreshBtn: boolean;
        latestTrackingInfo: LatestTrackingInfo;
        mailNo: string;
        originCountry: string;
        originCpList: any[];
        section1: Section;
        section2: Section;
        shippingTime: number;
        showEstimateTime: boolean;
        status: string;
        statusDesc: string;
        success: boolean;
        syncQuery: boolean;
    }

    export interface CainiaoResult {
        data: Datum[];
        success: boolean;
        timeSeconds: number;
    }

}

module Rastreamento {




    export async function correiosApi(code: string, type = "T"): Promise<undefined | CorreiosAPI.CorreiosAPITrackingResponse> {
        if (code == null || code == "" || code.length != 13) {
            return undefined;
        }
        const headers = {
            'Content-Type': 'application/xml',
            'Accept': 'application/json',
            'User-Agent': 'Dalvik/1.6.0 (Linux; U; Android 4.2.1; LG- P875h Build/JZO34L)'
        };
        const body = `
        <rastroObjeto>
        <usuario>${env.CORREIOS_USER!}</usuario>
        <senha>${env.CORREIOS_PASS!}</senha>
        <tipo>L</tipo>
        <resultado>${type}</resultado>
        <objetos>${code}</objetos>
        <lingua>101</lingua>
        </rastroObjeto>`
        try {
            var result = await axios.post(`http://webservice.correios.com.br/service/rest/rastro/rastroMobile`, body, { headers });
            return result.data as CorreiosAPI.CorreiosAPITrackingResponse;
        } catch (error) {
            console.log(error);
            try {
                var result = await axios.post(`https://correios.contrateumdev.com.br/api/rastreio`,
                    { code, type: 'LS' },
                );
                if (result.data.message === undefined) {
                    return result.data as CorreiosAPI.CorreiosAPITrackingResponse;
                }
            } catch (error) {
                console.error(error);
            }
        }
        return undefined;
    }
    export async function caniaoApi(code: string): Promise<undefined | CainiaoApi.Datum> {
        //JSON.parse($("#waybill_list_val_box").val()).data[0]
        try {
            const data = await axios.get(`https://global.cainiao.com/detail.htm?mailNoList=${code}`);
            const html = cheerioModule.load(data.data);
            const json = JSON.parse(html("#waybill_list_val_box").val()) as CainiaoApi.CainiaoResult;
            if (json.data.length > 0 && json.data[0].success) {
                const obj = json.data[0];
                return obj;
            }
        } catch (error) {
            console.log(error);
        }

        return undefined;
    }
    function formatEvent(event: CorreiosAPI.Evento): ApiResponse {
        const response = new ApiResponse();
        fixCaseLocal(event.destino?.[0]);
        response.status = event.descricao;
        response.locale = getLocale(event.unidade);
        response.observation = getObservation(event);
        //pode ser que em objetos internacionais o timezone seja diferente de -3, pensar em um fix
        const timezone = getTimeZoneFromCountry(getLocale(event.unidade)) || -3;

        if (event.criacao) {
            response.trackedAt = newDateFromTimeZone(parse(event.criacao, 'ddMMyyyyHHmmss', new Date()), timezone);
        } else {
            response.trackedAt = newDateFromTimeZone(parse(event.data + ' ' + event.hora, 'dd/MM/yyyy HH:mm', new Date()), timezone);
        }
        response.isFinished = isFinished(event);
        response.pickupAddress = pickupAddressFormatted(event);
        response.pickupAddresscoordinates = pickupAddresscoordinates(event);
        response.receiver = event?.recebedor?.nome?.trim() == '' || event?.recebedor?.nome?.trim() == '?' ? undefined : event?.recebedor?.nome?.trim();
        return response;
    }
    async function formatCaniaoEvent(obj: CainiaoApi.Datum): Promise<ApiResponse> {
        const response = new ApiResponse();

        response.status = await translate(obj.statusDesc);
        response.locale = upperCaseFirstLetterWord(getLocaleCainiao(obj) || "");
        response.observation = await translate(obj.latestTrackingInfo?.desc || "");
        response.trackedAt = newDateFromTimeZone(obj.latestTrackingInfo?.time || "", getTimezone(obj));
        response.isFinished = obj.statusDesc.toLowerCase()?.trim() == "delivered";
        return response;
    }


    export async function find(code: string,): Promise<undefined | ApiResponse> {
        if (code == null || code == "") {
            return undefined;
        }

        if (caniaoCode.test(code)) {
            console.log("cainiao");

            const cainiao = await caniaoApi(code);
            if (cainiao) {
                const formatedEventCainiao = formatCaniaoEvent(cainiao);
                if (cainiao.section2.mailNo !== undefined && correiosCode.test(cainiao.section2.mailNo)) {
                    const correios = await correiosApi(cainiao.section2.mailNo, "U");
                    if (correios && correios.objeto[0]?.evento?.[0]) {

                        const formatedEventCorreios = formatEvent(correios.objeto[0].evento[0]);

                        if (formatedEventCorreios.isFinished || (await formatedEventCainiao).trackedAt.getTime() <= formatedEventCorreios.trackedAt.getTime()) {
                            return formatedEventCorreios;
                        }
                    }
                }
                return formatedEventCainiao;
            }
        } else if (correiosCode.test(code)) {
            const correios = await correiosApi(code, "U");

            if (correios) {
                if (correios.objeto && correios.objeto.length > 0 && correios.objeto[0].evento) {
                    const track = correios.objeto[0].evento[0];
                    if (track) {
                        const formatedEventCorreios = formatEvent(track);
                        if (formatedEventCorreios.isFinished) {
                            return formatedEventCorreios;
                        } else {
                            const cainiao = await caniaoApi(code);
                            if (cainiao) {
                                const formatedEventCainiao = await formatCaniaoEvent(cainiao);
                                if (formatedEventCainiao.trackedAt.getTime() > formatedEventCorreios.trackedAt.getTime()) {
                                    return formatedEventCainiao;
                                }
                            }
                            return formatedEventCorreios;
                        }
                    }
                }
            }
            const cainiao = await caniaoApi(code);
            if (cainiao) {
                return formatCaniaoEvent(cainiao);
            }

        } else if (jadlogCode.test(code)) {
            const jadlog = await jadlogApi(code);
            if (jadlog) {
                return jadlog;
            }
        }


    }
    export async function findHistory(code: string): Promise<ApiResponse[]> {
        const result: ApiResponse[] = [];
        if (code != null || code != "") {
            if (caniaoCode.test(code)) {
                return [];
            } else {
                const data = await correiosApi(code, "T");
                if (data) {
                    if (data.objeto && data.objeto.length > 0 && data.objeto[0].evento) {
                        data.objeto[0].evento.forEach(event => {
                            result.push(formatEvent(event));
                        });
                    }
                }
            }
        }
        return result.reverse();
    }

}

export default Rastreamento;




function getTimezone(data: CainiaoApi.Datum): number {
    const str = data?.latestTrackingInfo?.timeZone;
    if (str !== undefined) {
        let timeZone = parseInt(str) || 0;
        if (timeZone === 0) {
            const list = data.section2?.detailList;
            if (list && list.length > 0) {
                const filter = list.filter(x => (parseInt(x.timeZone) || 0) !== 0);
                if (filter && filter.length > 0) {
                    timeZone = parseInt(filter[0].timeZone);
                }
            }
        }
        return timeZone;
    }
    return 0;
}
function pickupAddressFormatted(event: CorreiosAPI.Evento): string | undefined {

    if (event?.tipo?.toUpperCase() == "LDI") {
        return formatAddress(event.unidade.endereco);
    }
    return undefined;
}

async function translate(text: string, to: string = 'pt', from = "auto"): Promise<string> {
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

function pickupAddresscoordinates(event: CorreiosAPI.Evento): Object | undefined {

    if (event?.tipo?.toUpperCase() == "LDI" && event.unidade?.endereco?.latitude && event?.unidade?.endereco?.longitude) {
        return {
            latitude: event.unidade.endereco.latitude,
            longitude: event.unidade.endereco.longitude,
        }
    }
    return undefined;
}
function formatAddress(endereco: CorreiosAPI.Endereco): string | undefined {
    if (endereco) {
        let str = "";
        if (endereco.logradouro)
            str += `${upperCaseFirstLetterWord(endereco.logradouro?.trim())}`;

        if (endereco.numero)
            str += ` ${endereco.numero.trim()},`;
        if (endereco.bairro)
            str += ` ${upperCaseFirstLetterWord(endereco.bairro.trim())},`;
        if (endereco.localidade)
            str += ` ${upperCaseFirstLetterWord(endereco.localidade.trim())}-`;
        if (endereco.uf)
            str += `${endereco.uf.trim()}`;
        if (str !== "")
            return str.trim();

    }

}
function getLocale(unidade: CorreiosAPI.Unidade): string {
    if (unidade?.uf?.toLocaleUpperCase() == "BR") {
        return "Brasil"
    }

    if (unidade?.cidade && unidade?.uf) {
        return `${upperCaseFirstLetterWord(unidade.cidade.trim())}-${unidade.uf}`;
    }
    return upperCaseFirstLetterWord(unidade?.local || "");
}
function getLocaleCainiao(data: CainiaoApi.Datum): string {
    try {
        const filter = data?.section2?.detailList?.filter(detail => detail.status === "ARRIVED_AT_DEST_COUNTRY");
        if (filter?.length > 0) {
            return data.destCountry || "";
        }
        return data?.originCountry || "";
    } catch (error) {

    }
    return "";
}

function getObservation(event: CorreiosAPI.Evento): string {
    //TODO: melhorar algoritmo

    let observation = "";
    if (event.detalhe) {
        observation = event.detalhe;
    } else if (event?.destino == undefined) {
        observation = event.descricao;
    } else if (event?.unidade?.tipounidade == undefined) {
        observation = `${getLocale(event.unidade)} para ${getLocale(event.destino[0])}`;
    } else if (event?.unidade?.tipounidade.toLowerCase() == "país" || event?.unidade?.tipounidade.toLowerCase() == "pais") {
        if (event?.destino[0].local) {
            observation = `${getLocale(event.unidade)} para ${event?.destino[0].local} - ${getLocale(event.destino[0])}`;
        } else {
            observation = `${getLocale(event.unidade)} para ${getLocale(event.destino[0])}`;
        }
    } else {
        observation = `${event?.unidade.tipounidade} - ${getLocale(event.unidade)} para ${event?.destino[0].local} - ${getLocale(event.destino[0])}`;
    }
    if (event?.recebedor?.comentario && event.recebedor.comentario?.trim() != "" && event.recebedor.comentario?.trim() != "?") {
        observation += ` - ${event.recebedor.comentario}`;
    }
    return observation.trim();
}
function fixCaseLocal(unidade: CorreiosAPI.Unidade): void {
    let locale = unidade?.local;
    if (locale) {
        const words = locale.split(' ');
        const sigla = words[0];
        unidade.local = upperCaseFirstLetterWord(locale);
        unidade.local = unidade.local.replace(new RegExp(sigla, 'gi'), sigla);
    }
}

function isFinished(event: CorreiosAPI.Evento): boolean {
    event.tipo = event.tipo?.toUpperCase()?.trim();
    event.status = event.status?.toUpperCase()?.trim();
    /* Todos os objetos que forem retornados com o evento tipo 
    BDE, BDI e BDR com status 01, 12, 23, 50, 51, 52, 43, 67, 68, 70, 71, 72, 73, 74, 75, 76 e 80 e FC 11 
    estão com o histórico concluído.Não será mais necessário enviá - los para novas consultas.
    */
    const eventType = ["BDE", "BDI", "BDR"];
    const eventStatus = ["01", "12", "23", "50", "51", "52", "43", "67", "68", "70", "71", "72", "73", "74", "75", "76", "80"];
    return (eventType.includes(event.tipo) && eventStatus.includes(event.status)) || (event.tipo == "FC" && event.status == "11");
}

function getTimeZoneFromCountry(country: string): number | undefined {

    const countrys = getAllCountries();
    for (const key in countrys) {
        const element = countrys[key as keyof typeof countrys];
        if (element.name.toLowerCase() == country.toLowerCase()) {
            console.log(element);
        }
    }
    return undefined;
}

const app = express();

app.get('/:code', (req, res) => {
    const code = req.params.code.trim();
    Rastreamento.find(code)
        .then((result) => {
            res.json(result);
        }).catch((error) => {
            res.status(404).json({ status: "error" });
        }).finally(() => {
            res.end();
        });
});
app.get('/api/v1/:code', async (req, res) => {
    const code = req.params.code.trim();
    try {
        const result = await Rastreamento.find(code);
        if (result) {
            res.json(result);
        } else {
            res.status(404).json({ status: "not found" });
        }
    } catch (err) {
        console.log(err);
        res.status(500).json({ status: "error" });
    }


});
app.get('/api/v1/:code/complete', (req, res) => {
    const code = req.params.code.trim();
    Rastreamento.findHistory(code)
        .then((result) => {
            res.json(result);
        }).catch((error) => {
            console.log(error);

            res.status(404).json({ status: "error" });
        }).finally(() => {
            res.end();
        });
});
app.get('/api/correios/:code', (req, res) => {
    const code = req.params.code.trim();
    Rastreamento.correiosApi(code)
        .then((result) => {
            res.json(result);
        }).catch((error) => {
            res.status(404).json({});
        }).finally(() => {
            res.end();
        });
});

app.listen(env.PORT || 3000, () => console.log(`Correios app listening on port ${env.PORT || 3000}!`));