declare module Cainiao {



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
        latestTrackingInfo: Detail;
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
export = Cainiao;