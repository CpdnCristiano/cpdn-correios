import axios from 'axios';
import { getAllCountries } from 'countries-and-timezones';
import { parse } from 'date-fns';
import { env } from 'process';
import ApiResponse from '../models/api_reponse';
import { CorreiosAPITrackingResponse, Endereco, Evento, Unidade } from '../models/correios';
import { newDateFromTimeZone } from '../utils/date';
import { upperCaseFirstLetterWord } from '../utils/string';

module Correios {

    export async function correiosApi(code: string): Promise<ApiResponse | undefined> {
        try {
            const response = await correiosFind(code, "U");
            //  console.log(response?.objeto && response.objeto.length > 0 && response.objeto[0].evento);

            if (response?.objeto && response.objeto.length > 0 && response.objeto[0].evento) {
                const track = response.objeto[0].evento[0];
                if (track) {
                    return formatEvent(response.objeto[0].evento[0])
                }
            }
        } catch (error) {
            console.log(error);
        }
        return undefined;
    }
    export async function correiosFind(code: string, type = "T"): Promise<undefined | CorreiosAPITrackingResponse> {
        return correiosFind(code, type);
    }
}

export = Correios;

async function correiosFind(code: string, type = "T"): Promise<undefined | CorreiosAPITrackingResponse> {
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
        return result.data as CorreiosAPITrackingResponse;
    } catch (error) {
        console.log(error);
        try {
            var result = await axios.post(`https://correios.contrateumdev.com.br/api/rastreio`,
                { code, type: 'LS' },
            );
            if (result.data.message === undefined) {
                return result.data as CorreiosAPITrackingResponse;
            }
        } catch (error) {
            console.error(error);
        }
    }
    return undefined;
}
function formatEvent(event: Evento): ApiResponse {
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

function pickupAddressFormatted(event: Evento): string | undefined {

    if (event?.tipo?.toUpperCase() == "LDI") {
        return formatAddress(event.unidade.endereco);
    }
    return undefined;
}



function pickupAddresscoordinates(event: Evento): Object | undefined {

    if (event?.tipo?.toUpperCase() == "LDI" && event.unidade?.endereco?.latitude && event?.unidade?.endereco?.longitude) {
        return {
            latitude: event.unidade.endereco.latitude,
            longitude: event.unidade.endereco.longitude,
        }
    }
    return undefined;
}
function formatAddress(endereco: Endereco): string | undefined {
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
function getLocale(unidade: Unidade): string {
    if (unidade?.uf?.toLocaleUpperCase() == "BR") {
        return "Brasil"
    }

    if (unidade?.cidade && unidade?.uf) {
        return `${upperCaseFirstLetterWord(unidade.cidade.trim())}-${unidade.uf}`;
    }
    return upperCaseFirstLetterWord(unidade?.local || "");
}


function getObservation(event: Evento): string {
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
function fixCaseLocal(unidade: Unidade): void {
    let locale = unidade?.local;
    if (locale) {
        const words = locale.split(' ');
        const sigla = words[0];
        unidade.local = upperCaseFirstLetterWord(locale);
        unidade.local = unidade.local.replace(new RegExp(sigla, 'gi'), sigla);
    }
}

function isFinished(event: Evento): boolean {
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
            // console.log(element);
        }
    }
    return undefined;
}