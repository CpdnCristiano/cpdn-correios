import axios from 'axios';
import { parse } from 'date-fns';
import { env } from 'process';
import express from "express";

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
        isFinished: boolean;
        trackedAt: Date;
    }
    class RastrearResponse implements TrackingResult {
        status!: string;
        locale!: string;
        observation!: string;
        isFinished: boolean = false;
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
    export async function correiosApi(code: string): Promise<undefined | CorreiosAPI.CorreiosAPITrackingResponse> {
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
            return result.data as CorreiosAPI.CorreiosAPITrackingResponse;
        } catch (error) {
        }
        return undefined;
    }
    function formatEvent(event: CorreiosAPI.Evento): RastrearResponse {
        const response = new RastrearResponse();
        response.status = event.descricao;
        response.locale = getLocale(event.unidade);
        response.observation = getObservation(event);
        response.trackedAt = parse(event.data + ' ' + event.hora, 'dd/MM/yyyy HH:mm', new Date());
        response.isFinished = isFinished(event);
        return response;
    }

    export async function find(code: string): Promise<undefined | RastrearResponse> {
        const data = await correiosApi(code);
        if (data) {
            if (data.objeto && data.objeto.length > 0 && data.objeto[0].evento) {
                const track = data.objeto[0].evento[0];
                if (track) {
                    return formatEvent(track);
                }
            }
        }
    }
    export async function findHistory(code: string): Promise<RastrearResponse[]> {
        const data = await correiosApi(code);
        const result: RastrearResponse[] = [];
        if (data) {
            if (data.objeto && data.objeto.length > 0 && data.objeto[0].evento) {
                data.objeto[0].evento.forEach(event => {
                    result.push(formatEvent(event));
                });
            }
        }
        return result.reverse();
    }
}


export default Rastreamento;

function getLocale(unidade: CorreiosAPI.Unidade): string {
    if (unidade?.uf?.toLocaleUpperCase() == "BR") {
        return "Brasil"
    }

    if (unidade?.cidade && unidade?.uf) {
        return `${upperCaseFirstLetterWord(unidade.cidade.trim())}-${unidade.uf}`;
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
function upperCaseFirstLetterWord(str: string) {
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
function upperCaseFirstLetter(str: string) {
    str = str.toLowerCase();
    return str.length > 1 ? str[0].toUpperCase() + str.substring(1) : str.toUpperCase();
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
app.get('/api/v1/:code', (req, res) => {
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
app.get('/api/v1/:code/complete', (req, res) => {
    const code = req.params.code.trim();
    Rastreamento.findHistory(code)
        .then((result) => {
            res.json(result);
        }).catch((error) => {
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