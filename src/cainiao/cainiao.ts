import axios from 'axios';
import { load } from 'cheerio';
import ApiResponse from '../models/api_reponse';
import { CainiaoResult, Datum, Detail } from '../models/cainiao';
import { newDateFromTimeZone } from '../utils/date';
import { translate, upperCaseFirstLetterWord } from '../utils/string';


module Cainiao {
    export async function cainiaoApi(code: string): Promise<ApiResponse | undefined> {
        try {
            const response = await cainiaoFind(code);
            if (response) {
                //  response.section2.detailList.forEach(a => console.log(a));
                return formatEvent(response)
            }
        } catch (error) {
            console.log(error);
        }
        return undefined;
    }
}
export = Cainiao;

async function formatEvent(obj: Datum): Promise<ApiResponse> {
    //  console.log(obj);

    const response = new ApiResponse();
    response.newCode = getNewCode(obj);
    response.status = await getStatus(obj.statusDesc);;
    response.locale = upperCaseFirstLetterWord(getLocaleCainiao(obj) || "");
    response.observation = await getObservation(obj.latestTrackingInfo);
    response.trackedAt = newDateFromTimeZone(obj.latestTrackingInfo?.time || "", getTimezone(obj));
    response.isFinished = obj.statusDesc.toLowerCase()?.trim() == "delivered";
    return response;
}

async function cainiaoFind(code: string): Promise<undefined | Datum> {
    //JSON.parse($("#waybill_list_val_box").val()).data[0]
    try {
        const data = await axios.get(`https://global.cainiao.com/detail.htm?mailNoList=${code}`);
        const html = load(data.data);
        const json = JSON.parse(html("#waybill_list_val_box").val()) as CainiaoResult;
        if (json.data.length > 0 && json.data[0].success) {
            const obj = json.data[0];

            return obj;
        }
    } catch (error) {
        console.log(error);
    }

    return undefined;
}

function getLocaleCainiao(data: Datum): string {
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
function getTimezone(data: Datum): number {
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


async function getObservation(detail: Detail): Promise<string> {

    switch (detail.status?.trim()?.toLowerCase().trim()) {
        case "DEPART_FROM_ORIGINAL_COUNTRY".toLowerCase().trim():
            return "Saída do país de origem";
        case "ARRIVED_AT_DEST_COUNTRY":
            return "Chegou ao  país de destino";
        default:
            switch (detail.desc?.trim()?.toLowerCase().trim()) {
                case "Accepted by carrier".toLowerCase().trim():
                    return "Pacote Aceito pela traspodatora"
                case "Order received successfully".toLowerCase().trim():
                    return "Pedido recebido com sucesso"
                case "包裹已出库".toLowerCase().trim()://return "O pacote saiu do armazém";
                case "Leave the warehouse".toLowerCase().trim(): //return "Saia do armazém";
                case "Inbound in sorting center".toLowerCase().trim():
                    return "Entrada no centro de triagem";
                //case "Hand over for line-haul transportation".toLowerCase().trim():return "Entregue para traspodadora";
                case "Outbound in sorting center".toLowerCase().trim():
                    return "Saída no centro de triagem";
                case "Received by line-haul".toLowerCase().trim():
                    return "Recebido na traspodadora";
                case "Export clearance success".toLowerCase().trim():
                    return "Liberação de exportação bem-sucedida";
                case "Import clearance success".toLowerCase().trim():
                    return "Liberação de impotação bem-sucedida";

                default:
                    return await translate(detail.desc || "");
            }
    }
}
async function getStatus(status: string): Promise<string> {
    switch (status?.trim().toLowerCase()) {
        case "Your parcel is in transit".toLowerCase():
            return "Seu pacote está em trânsito";
        default:
            return await translate(status);
    }
}
function getNewCode(data: Datum): string | undefined {
    const newCode = data.section2.mailNo;
    if (newCode) {
        return newCode;
    }
    if (data.mailNo.toUpperCase().includes("New Tracking Number:".toUpperCase())) {
        const newCode = data.mailNo.split("New Tracking Number:")[1].trim().replace(/\)/g, "");
        return newCode?.toUpperCase();
    }
    return undefined;

}
