import { env } from 'process';
import express from "express";
import ApiResponse from './models/api_reponse';
import { jadlogApi } from './jadlog/jadlog';
import { cainiaoApi } from './cainiao/cainiao';
import { correiosApi, correiosApiOriginal } from './correios/correios';

const caniaoCode = /^(LP\d{14})|(SY\d{11})$/i
const correiosCode = /[a-z]{2}\d{9}[a-z]{2}/i;
const jadlogCode = /^\d{14}$/i;



module Rastreamento {

    export async function find(code: string,): Promise<undefined | ApiResponse> {
        if (code !== undefined && code !== "") {


            if (jadlogCode.test(code)) {
                const jadlog = await jadlogApi(code);
                if (jadlog) {
                    return jadlog;
                }
            } else {
                const cainiao = await cainiaoApi(code);
                code = cainiao?.newCode || code;
                if (correiosCode.test(code)) {
                    const correios = await correiosApi(code);
                    if (correios) {
                        if (cainiao) {
                            if (correios.isFinished || correios.trackedAt.getTime() > cainiao.trackedAt.getTime()) {

                                return correios;
                            }
                        } else {
                            return correios;
                        }
                    }
                }
                return cainiao;
            }
        }
        return undefined;
    }
    export async function findHistory(code: string): Promise<ApiResponse[]> {
        /* const result: ApiResponse[] = [];
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
        return result.reverse(); */
        return [];
    }
}



export = Rastreamento;







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
    correiosApiOriginal(code)
        .then((result) => {
            res.json(result);
        }).catch((error) => {
            res.status(404).json({});
        }).finally(() => {
            res.end();
        });
});

app.listen(env.PORT || 3000, () => console.log(`Correios app listening on port ${env.PORT || 3000}!`));