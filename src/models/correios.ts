declare module Correios {
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

export = Correios;