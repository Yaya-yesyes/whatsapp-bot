import crypto from 'crypto'
import { proto } from '@whiskeysockets/baileys'

function botMetadataCertificate(size = 685) {
    const buffer = Buffer.alloc(size)
    crypto.randomFillSync(buffer)
    return buffer
}

function botMetadataSignature() {
    const buffer = Buffer.alloc(64)
    crypto.randomFillSync(buffer)
    return buffer
}

export function createRichHtmlMessage(html, title = 'Rich HTML') {
    const responseId = crypto.randomUUID()

    const unified = {
        response_id: responseId,

        sections: [
            {
                view_model: {
                    primitive: {
                        __typename: 'GenAIaeacdsnwHtmlPrimitive',
                        payload: html
                    },
                    __typename: 'GenAISingleLayoutViewModel'
                }
            }
        ]
    }

    const richResponseMessage =
        proto.AIRichResponseMessage.create({
            submessages: [
                {
                    messageType: 2,
                    messageText: title
                }
            ],

            messageType:
                proto.AIRichResponseMessageType
                    .AI_RICH_RESPONSE_TYPE_STANDARD,

            unifiedResponse: {
                data: Buffer.from(
                    JSON.stringify(unified)
                )
            },

            contextInfo: {
                isForwarded: true,
                forwardingScore: 1,

                forwardedAiBotMessageInfo: {
                    botJid: '867051314767696@bot'
                },

                forwardOrigin: 4
            }
        })

    return {
        messageContextInfo: {
            botMetadata: {
                verificationMetadata: {
                    proofs: [
                        {
                            certificateChain: [
                                botMetadataCertificate(),
                                botMetadataCertificate(892)
                            ],

                            version: 1,
                            useCase: 1,

                            signature:
                                botMetadataSignature()
                        }
                    ]
                }
            }
        },

        botForwardedMessage: {
            message: {
                richResponseMessage
            }
        }
    }
}