import { useState, useRef, useCallback, useEffect } from 'react';

const SERVICE_UUID = "12345678-1234-5678-1234-56789abcdef0";
const CHAR_UUID = "87654321-4321-6789-4321-fedcba987654";

export interface SensorData {
    hr: number;
    spo2: number;
    az: number;
    ir: number;
    rpm: number;        // Tần số hô hấp
    stress: number;     // Mức độ căng thẳng (0-100)
    sys: number;        // Huyết áp tâm thu
    dia: number;        // Huyết áp tâm trương
    rmssd: number;      // Chỉ số HRV
    motion: number;     // 0 = yên, 1 = cử động
    t?: number;
}

const EMPTY_DATA: SensorData = {
    hr: 0, spo2: 0, az: 0, ir: 0,
    rpm: 0, stress: 0, sys: 0, dia: 0,
    rmssd: 0, motion: 0
};

export default function useStrokeguardBLE() {
    const [sensorData, setSensorData] = useState<SensorData>(EMPTY_DATA);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [deviceName, setDeviceName] = useState<string>('');

    const latestDataRef = useRef<SensorData>(EMPTY_DATA);
    const deviceRef = useRef<any>(null);
    const charRef = useRef<any>(null);

    // Throttling: cứ 500ms mới đẩy dữ liệu vào state
    useEffect(() => {
        const interval = setInterval(() => {
            if (isConnected) {
                setSensorData(latestDataRef.current);
            }
        }, 500);
        return () => clearInterval(interval);
    }, [isConnected]);

    // Cleanup khi component unmount
    useEffect(() => {
        return () => {
            if (deviceRef.current && deviceRef.current.gatt.connected) {
                try { deviceRef.current.gatt.disconnect(); } catch (e) {}
            }
        };
    }, []);

    const connect = useCallback(async () => {
        if (deviceRef.current && deviceRef.current.gatt.connected) return;

        try {
            const device = await (navigator as any).bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [SERVICE_UUID]
            });

            deviceRef.current = device;
            setDeviceName(device.name || 'STROKEGUARD');

            device.addEventListener('gattserverdisconnected', () => {
                console.log("Đã ngắt kết nối BLE");
                setIsConnected(false);
                setDeviceName('');
                latestDataRef.current = EMPTY_DATA;
                setSensorData(EMPTY_DATA);
            });

            const server = await device.gatt.connect();
            const service = await server.getPrimaryService(SERVICE_UUID);
            const char = await service.getCharacteristic(CHAR_UUID);
            charRef.current = char;

            await char.startNotifications();
            setIsConnected(true);

            char.addEventListener('characteristicvaluechanged', (event: any) => {
                try {
                    const raw = new TextDecoder('utf-8').decode(event.target.value);
                    const parsed: SensorData = JSON.parse(raw);
                    latestDataRef.current = parsed;
                } catch (e) {}
            });

        } catch (error: any) {
            if (error.name === 'NotFoundError') {
                console.log("Người dùng đã hủy chọn thiết bị");
            } else {
                console.error("Lỗi kết nối BLE:", error);
                alert("Không thể kết nối với vòng tay STROKEGUARD!\n" + (error.message || ''));
            }
            setIsConnected(false);
        }
    }, []);

    const disconnect = useCallback(async () => {
        try {
            if (charRef.current) {
                try { await charRef.current.stopNotifications(); } catch (e) {}
                charRef.current = null;
            }
            if (deviceRef.current && deviceRef.current.gatt.connected) {
                deviceRef.current.gatt.disconnect();
            }
        } catch (e) {
            console.error("Lỗi khi ngắt kết nối:", e);
        } finally {
            setIsConnected(false);
            setDeviceName('');
            latestDataRef.current = EMPTY_DATA;
            setSensorData(EMPTY_DATA);
        }
    }, []);

    return { connect, disconnect, isConnected, sensorData, deviceName };
}
