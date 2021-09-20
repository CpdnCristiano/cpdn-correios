class ApiResponse {

    status!: string;
    locale!: string;
    observation!: string;
    isFinished: boolean = false;
    trackedAt!: Date;
    pickupAddress?: string;
    pickupAddresscoordinates?: LanLng;
    receiver?: string;

}
interface LanLng {
    latitude?: number | string;
    longitude?: number | string;
}
export default ApiResponse;