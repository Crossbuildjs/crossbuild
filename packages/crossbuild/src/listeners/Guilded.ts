import { GeneratedMessage } from "@crossbuild/types"
import { CrossBuild, LogLevel, ReceivedInteraction } from "../index.js"
import { Message } from "guilded.js"

export default class GuildedListener {
    client: CrossBuild
    constructor(client: CrossBuild) {
        this.client = client
    }

    public async startListening() {
        this.client.guildedClient?.on("messageCreated", (message) => {
            this.message(message)
        })
    }

    public async stopListening() {
        this.client.guildedClient?.off("messageCreated", (message) => {
            this.message(message)
        })
    }

    private async message(guildedMessage: Message) {
        if (!this.client.config.prefix) return this.client.log("No prefix provided, not listening for commands.", LogLevel.DEBUG)

        if (!guildedMessage.content.startsWith(this.client.config.prefix)) return

        const args = guildedMessage.content.slice(this.client.config.prefix.length).trim().split(/ +/g)
        const command = args.shift()?.toLowerCase()
        if (!command) return

        const flags: { [key: string]: string } = {}
        const regex = /--([^\s]+) ([^\s]+)/g

        let match
        while ((match = regex.exec(guildedMessage.content))) {
            flags[match[1]] = match[2]
        }

        const interaction = new ReceivedInteraction(this.client, {
            key: command,
            source: "guilded",
            type: "command",
            originalGuildedMessage: guildedMessage,
            options: flags,
            server: guildedMessage.server ? {
                id: guildedMessage.server.id,
                ownerId: guildedMessage.server.ownerId,
                name: guildedMessage.server.name,
                iconURL: guildedMessage.server.iconURL || undefined,
                description: guildedMessage.server.description || undefined
            } : guildedMessage.serverId ? { id: guildedMessage.serverId } : null,
            channel: guildedMessage.channel ? {
                id: guildedMessage.channel.id,
                name: guildedMessage.channel.name,
                parentId: guildedMessage.channel.parentId || undefined,
                send: async (message: GeneratedMessage) => {
                    await guildedMessage.channel?.send(message)
                }
            } : guildedMessage.channelId ? {
                id: guildedMessage.channelId,
                send: async (message: GeneratedMessage) => {
                    const channel = await this.client.guildedClient?.channels.fetch(guildedMessage.channelId)
                    channel?.send(message)
                }
            } : null,
            user: guildedMessage.author ? {
                id: guildedMessage.author.id,
                displayName: guildedMessage.author.name,
                username: guildedMessage.author.name,
                avatarURL: guildedMessage.author.avatar || undefined,
                permissions: []
            } : { id: guildedMessage.authorId },
        })
        this.client.componentHandler.handleComponent(interaction)
    }
}
