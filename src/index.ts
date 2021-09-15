import axios from 'axios';
import { parse } from 'date-fns';
import { env } from 'process';

declare module CorreiosAPI {
    export interface Recebedor {
    }
    export interface Endereco {
        codigo?: string;
        cep?: string;
        logradouro?: string;
        numero?: string;
        localidade?: string;
        uf?: string;
        bairro?: string;
        latitude?: string;
        longitude?: string;
        complemento?: string;
    }

    export interface Unidade {
        local: string;
        codigo?: string;
        cidade?: string;
        uf?: string;
        sto?: string;
        tipounidade?: string;
        endereco: Endereco;
    }

    export interface DetalheOEC {
        carteiro: string;
        distrito: string;
        lista: string;
        unidade: string;
    }

    export interface Destino {
        local: string;
        codigo: string;
        cidade: string;
        bairro: string;
        uf: string;
        endereco: Endereco;
    }

    export interface Evento {
        tipo: string;
        status: string;
        data: string;
        hora: string;
        criacao: string;
        descricao: string;
        recebedor: Recebedor;
        unidade: Unidade;
        cepDestino: string;
        prazoGuarda: string;
        diasUteis: string;
        dataPostagem: string;
        detalheOEC: DetalheOEC;
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
module Rastreamento {

    export interface TrackingResult {
        status: string;
        locale: string;
        observation: string;
        isDelivered: boolean;
        trackedAt: Date;
    }
    class RastrearResponse implements TrackingResult {
        status!: string;
        locale!: string;
        observation!: string;
        isDelivered: boolean = false;
        trackedAt!: Date;
    }
    interface RastreioBREvent {
        status: string;
        data: string;
        hora: string;
        origem?: string;
        destino?: string;
        local?: string;
    }
    type RatreioBREvents = Array<RastreioBREvent>;
    async function correiosApi(code: string): Promise<undefined | RastrearResponse> {
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
        <resultado>T</resultado>
        <objetos>${code}</objetos>
        <lingua>101</lingua>
        </rastroObjeto>`
        try {
            var result = await axios.post(`http://webservice.correios.com.br/service/rest/rastro/rastroMobile`, body, { headers });
            const data = result.data as CorreiosAPI.CorreiosAPITrackingResponse;
            if (data.objeto && data.objeto.length > 0 && data.objeto[0].evento) {
                const track = data.objeto[0].evento[0];
                if (track) {
                    const response = new RastrearResponse();
                    response.status = track.descricao;
                    response.locale = getLocale(track.unidade);
                    response.observation = getObservation(track);
                    response.trackedAt = parse(track.data + ' ' + track.hora, 'dd/MM/yyyy HH:mm', new Date());
                    response.isDelivered = isFinished(track);
                    return response;
                }
            }
        } catch (error) {
        }
        return undefined;
    }

    export async function find(code: string): Promise<undefined | RastrearResponse> {
        return correiosApi(code);
    }
}


export default Rastreamento;

function getLocale(unidade: CorreiosAPI.Unidade): string {
    if (unidade?.uf?.toLocaleUpperCase() == "BR") {
        return "Brasil"
    }

    if (unidade?.cidade && unidade?.uf) {
        return `${upperCaseFirstLetterWord(unidade.cidade.trim())} - ${unidade.uf}`;
    }
    return upperCaseFirstLetterWord(unidade?.local || "");
}
function getObservation(event: CorreiosAPI.Evento): string {
    if (event?.destino == undefined) {
        return event.descricao;
    }
    if (event?.unidade?.tipounidade) {
        return `${getLocale(event.unidade)} para ${getLocale(event.destino[0])}`;
    }
    return `${event?.unidade.tipounidade} - ${getLocale(event.unidade)} para ${event?.destino[0].local} - ${getLocale(event.destino[0])}`;
}

function isFinished(event: CorreiosAPI.Evento): boolean {
    event.tipo = event.tipo?.toUpperCase()?.trim();
    event.status = event.status?.toUpperCase()?.trim();
    const eventType = ["BDE", "BDI", "BDR"];
    const eventStatus = ["01", "12", "23", "50", "51", "52", "43", "67", "68", "70", "71", "72", "73", "74", "75", "76", "80"];//e FC 11
    return (eventType.includes(event.tipo) && eventStatus.includes(event.status)) || (event.tipo == "FC" && event.status == "11");
}
export function upperCaseFirstLetterWord(str: string) {
    if (str === "") {
        return str;
    }
    var array = str.split(" ");
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