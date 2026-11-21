import { useState, useRef, useCallback, useEffect } from 'react';

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
    // State dùng để render UI (Sẽ được cập nhật 2 lần/giây)
    const [sensorData, setSensorData] = useState<SensorData>({ hr: 0, spo2: 0, az: 0, ir: 0 });
    const [isConnected, setIsConnected] = useState<boolean>(false);
    
    // Ref dùng để lưu dữ liệu tức thời từ BLE (Cập nhật liên tục 10 lần/giây)
    const latestDataRef = useRef<SensorData>({ hr: 0, spo2: 0, az: 0, ir: 0 });
    const deviceRef = useRef<any>(null);

    // Bộ đếm thời gian (Throttling): Cứ 500ms mới đẩy dữ liệu vào State một lần
    useEffect(() => {
        const interval = setInterval(() => {
            // Chỉ cập nhật nếu đã có kết nối (tránh cập nhật rác)
            if (isConnected) {
                setSensorData(latestDataRef.current);
            }
        }, 500); 
        return () => clearInterval(interval);
    }, [isConnected]);

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

            // Nhận dữ liệu liên tục nhưng CHỈ LƯU VÀO REF (Không làm React re-render)
            char.addEventListener('characteristicvaluechanged', (event: any) => {
                const raw = new TextDecoder('utf-8').decode(event.target.value);
                try {
                    const parsedData: SensorData = JSON.parse(raw);
                    latestDataRef.current = parsedData; 
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
