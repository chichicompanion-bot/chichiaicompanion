import { useState, useRef, useCallback } from 'react';

const SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0";
const CHAR_UUID = "87654321-4321-6789-4321-fedcba987654";

export interface SensorData {
    hr: number;
    spo2: number;
    az: number;
    ir: number;
    t?: number;
}

export default function useStrokeguardBLE() {
    const [sensorData, setSensorData] = useState<SensorData>({ hr: 0, spo2: 0, az: 0, ir: 0 });
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const deviceRef = useRef<any>(null);

    const connect = useCallback(async () => {
        try {
            const device = await (navigator as any).bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [SERVICE_UUID]
            });
            
            deviceRef.current = device;
            
            device.addEventListener('gattserverdisconnected', () => {
                setIsConnected(false);
                console.log("Đã ngắt kết nối BLE");
            });

            const server = await device.gatt.connect();
            const service = await server.getPrimaryService(SERVICE_UUID);
            const char = await service.getCharacteristic(CHAR_UUID);

            await char.startNotifications();
            setIsConnected(true);

            char.addEventListener('characteristicvaluechanged', (event: any) => {
                const raw = new TextDecoder('utf-8').decode(event.target.value);
                try {
                    const parsedData: SensorData = JSON.parse(raw);
                    setSensorData(parsedData);
                } catch (e) {}
            });

        } catch (error) {
            console.error("Lỗi kết nối BLE:", error);
            alert("Không thể kết nối với vòng tay STROKEGUARD!");
        }
    }, []);

    const disconnect = useCallback(() => {
        if (deviceRef.current && deviceRef.current.gatt.connected) {
            deviceRef.current.gatt.disconnect();
        }
    }, []);

    return { connect, disconnect, isConnected, sensorData };
}
