"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const date_fns_1 = require("date-fns");
const process_1 = require("process");
const express_1 = __importDefault(require("express"));
var Rastreamento;
(function (Rastreamento) {
    class RastrearResponse {
        constructor() {
            this.isFinished = false;
        }
    }
    async function correiosApi(code) {
        const headers = {
            'Content-Type': 'application/xml',
            'Accept': 'application/json',
            'User-Agent': 'Dalvik/1.6.0 (Linux; U; Android 4.2.1; LG- P875h Build/JZO34L)'
        };
        const body = `
        <rastroObjeto>
        <usuario>${process_1.env.CORREIOS_USER}</usuario>
        <senha>${process_1.env.CORREIOS_PASS}</senha>
        <tipo>L</tipo>
        <resultado>T</resultado>
        <objetos>${code}</objetos>
        <lingua>101</lingua>
        </rastroObjeto>`;
        try {
            var result = await axios_1.default.post(`http://webservice.correios.com.br/service/rest/rastro/rastroMobile`, body, { headers });
            const data = result.data;
            if (data.objeto && data.objeto.length > 0 && data.objeto[0].evento) {
                const track = data.objeto[0].evento[0];
                if (track) {
                    const response = new RastrearResponse();
                    response.status = track.descricao;
                    response.locale = getLocale(track.unidade);
                    response.observation = getObservation(track);
                    response.trackedAt = (0, date_fns_1.parse)(track.data + ' ' + track.hora, 'dd/MM/yyyy HH:mm', new Date());
                    response.isFinished = isFinished(track);
                    return response;
                }
            }
        }
        catch (error) {
        }
        return undefined;
    }
    async function find(code) {
        return correiosApi(code);
    }
    Rastreamento.find = find;
})(Rastreamento || (Rastreamento = {}));
exports.default = Rastreamento;
function getLocale(unidade) {
    if (unidade?.uf?.toLocaleUpperCase() == "BR") {
        return "Brasil";
    }
    if (unidade?.cidade && unidade?.uf) {
        return `${upperCaseFirstLetterWord(unidade.cidade.trim())} - ${unidade.uf}`;
    }
    return upperCaseFirstLetterWord(unidade?.local || "");
}
function getObservation(event) {
    if (event?.destino == undefined) {
        return event.descricao;
    }
    if (event?.unidade?.tipounidade) {
        return `${getLocale(event.unidade)} para ${getLocale(event.destino[0])}`;
    }
    return `${event?.unidade.tipounidade} - ${getLocale(event.unidade)} para ${event?.destino[0].local} - ${getLocale(event.destino[0])}`;
}
function isFinished(event) {
    event.tipo = event.tipo?.toUpperCase()?.trim();
    event.status = event.status?.toUpperCase()?.trim();
    const eventType = ["BDE", "BDI", "BDR"];
    const eventStatus = ["01", "12", "23", "50", "51", "52", "43", "67", "68", "70", "71", "72", "73", "74", "75", "76", "80"]; //e FC 11
    return (eventType.includes(event.tipo) && eventStatus.includes(event.status)) || (event.tipo == "FC" && event.status == "11");
}
function upperCaseFirstLetterWord(str) {
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
function upperCaseFirstLetter(str) {
    str = str.toLowerCase();
    return str.length > 1 ? str[0].toUpperCase() + str.substring(1) : str.toUpperCase();
}
const app = (0, express_1.default)();
app.get('/:code', (req, res) => {
    const code = req.params.code.trim();
    Rastreamento.find(code)
        .then((result) => {
        res.json(result);
    }).catch((error) => {
        res.status(404).json({});
    }).finally(() => {
        res.end();
    });
});
app.listen(process_1.env.PORT || 3000, () => console.log(`Example app listening on port ${process_1.env.PORT || 3000}!`));
