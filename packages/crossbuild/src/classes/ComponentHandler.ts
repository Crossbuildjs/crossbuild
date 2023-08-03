import { CrossBuild, LogLevel, ReceivedInteraction, Component, ComponentType, OptionsHandler } from "../index.js"
import { generateEmbed, getFiles } from "@crossbuild/functions"
import { ApplicationCommandData, ApplicationCommandOptionData, ApplicationCommandOptionType } from "discord.js"
import path from "path"

export default class ComponentHandler {
    public client: CrossBuild

    constructor(client: CrossBuild) {
        this.client = client
    }

    public async loadFiles() {
        Promise.all(
            this.client.config.componentPaths.map(async (dirPath) => {
                try {
                    const typePath = path.join(this.client.__dirname, dirPath)
                    const files = getFiles(typePath, "js", true)

                    for (const fileName of files) {
                        const filePath = path.join(typePath, fileName)
                        const fileUrl = `file://${filePath.replace(/\\/g, "/")}`
                        const file = await import(fileUrl)
                        const component = new file.default(this.client) as Component
                        this.client.components.set(`${component.type}-${component.key}`, component)
                    }
                } catch (error) {
                    this.client.log(
                        `Failed to load files under ${dirPath}. Make sure you are only giving a subdirectory from ${this.client.__dirname}`,
                        LogLevel.WARN
                    )
                }
            })
        ).then(() => {
            this.postLoad()
        })
    }

    public postLoad() {
        if (this.client.discordClient) {
            if (this.client.discordClient.application) {
                this.syncDiscordCommands()
            } else {
                this.client.discordClient.once("ready", () => {
                    this.syncDiscordCommands()
                })
            }
        }
    }

    public reloadFiles() {
        this.client.components.clear()
        this.loadFiles()
    }

    public syncDiscordCommands() {
        if (!this.client.discordClient) return this.client.log("Discord client is not defined, cannot sync commands.", LogLevel.WARN)

        try {
            this.client.discordClient?.application?.commands.set(
                this.client.components
                    .filter((x) => x.type === "command")
                    .map((command) => {
                        const data: ApplicationCommandData = {
                            name: command.key,
                            description: command.description || "No description provided",
                            options: command.options?.map((option) => {
                                return {
                                    type: option.type === "string" ? ApplicationCommandOptionType.String :
                                        option.type === "integer" ? ApplicationCommandOptionType.Integer :
                                            option.type === "boolean" ? ApplicationCommandOptionType.Boolean :
                                                ApplicationCommandOptionType.String,
                                    name: option.name,
                                    description: option.description || "No description provided",
                                    required: option.required || false,
                                    choices: option.choices,
                                    min_value: option.minValue,
                                    max_value: option.maxValue,
                                    min_length: option.minLength,
                                    max_length: option.maxLength,
                                } as ApplicationCommandOptionData
                            })
                        }
                        return data
                    })
            )
        } catch (error) {
            this.client.log(`Failed to sync Discord commands: ${error}`, LogLevel.WARN)
        }
    }

    public fetchComponent(key: string, type: ComponentType) {
        return this.client.components.get(`${type}-${key}`) || undefined
    }

    // Override in specific handlers
    public async specificChecks(interaction: ReceivedInteraction, component: Component): Promise<unknown> {
        return this.client.log(`${interaction}${component}`, LogLevel.NULL) // This line is here to prevent unused variable errors
    }

    public async handleComponent(interaction: ReceivedInteraction) {
        const key = interaction.key
        const type = interaction.type
        if (interaction.isDiscordComponent() && key.startsWith("x-"))
            return this.client.log(`Ignoring ${type} with key ${key}, it should be handled with a collector on a message.`, LogLevel.DEBUG)
        const component = this.fetchComponent(key, type)
        if (!component) return this.client.log(`Unable to find ${type} with key ${key}, but it was triggered by a user.`, LogLevel.WARN)

        const options = new OptionsHandler(interaction.rawOptions || {}, component.options || [])

        this.specificChecks(interaction, component)

        const missingPermissions = await component.validate(interaction, options)
        if (missingPermissions) return interaction.reply(generateEmbed("error", missingPermissions))

        return this.runComponent(component, interaction, options)
    }

    private async runComponent(component: Component, interaction: ReceivedInteraction, options: OptionsHandler) {
        this.client.usersUsingBot.add(interaction.user!.id)

        await component.run(interaction, options).catch(async (error: unknown): Promise<unknown> => {
            this.client.log(`${error}`, LogLevel.ERROR)
            const toSend = generateEmbed(
                "error",
                {
                    title: "An Error Has Occurred",
                    description: `An unexpected error was encountered while running this ${component.type}, my developers have already been notified! Feel free to join my support server in the mean time!`
                },
                [],
                true,
                this.client.config.supportServer
            )
            // if (interaction.replied) return interaction.followUp(toSend)
            // if (interaction.deferred) return interaction.editReply(toSend)
            return interaction.reply(toSend)
        })
    }
}
