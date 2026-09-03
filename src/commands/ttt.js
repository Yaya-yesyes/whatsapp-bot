// src/commands/ttt.js

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { createRichHtmlMessage } from '../utils/richHtml.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tttHtmlPath = path.join(
    __dirname,
    '../games/ttt.html'
);

export default async function tttCommand(sock, jid) {

    try {

        const html = fs.readFileSync(
            tttHtmlPath,
            'utf8'
        );

        const message =
            createRichHtmlMessage(
                html,
                'Tic-Tac-Toe - Denia'
            );

        await sock.relayMessage(
            jid,
            message,
            {
                messageId:
                    crypto.randomUUID()
            }
        );

    } catch (error) {

        console.error(
            'TTT ERROR:',
            error
        );

        await sock.sendMessage(
            jid,
            {
                text:
                    '❌ Gagal membuka Tic-Tac-Toe.'
            }
        );

    }

}