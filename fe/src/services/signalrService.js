import * as signalR from '@microsoft/signalr'
import { SIGNALR_HUB, TOKEN } from '../utils/constants/System'

let hubConnection = null

export const startSignalRConnection = async (onMessageReceived) => {
    try {
        if (!SIGNALR_HUB) {
            return null
        }

        if (hubConnection && hubConnection.state === signalR.HubConnectionState.Connected) {
            return hubConnection
        }

        hubConnection = new signalR.HubConnectionBuilder()
            .withUrl(SIGNALR_HUB, {
                accessTokenFactory: () => localStorage.getItem(TOKEN) || '',
            })
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Warning)
            .build()

        if (onMessageReceived) {
            hubConnection.on('ReceiveNotification', onMessageReceived)
        }

        await hubConnection.start()
        return hubConnection
    } catch {
        return null
    }
}

export const stopSignalRConnection = async () => {
    if (hubConnection) {
        try {
            await hubConnection.stop()
        } catch {
            // ignore stop errors
        }
    }
}

export const getSignalRConnection = () => hubConnection
