import cors from 'cors';

import * as net from 'net';
import * as http from 'http';
import * as path from 'path';
import { ChildProcess, spawn } from 'child_process';

import createApplication from 'express';
import * as express from 'express';
import helmet from 'helmet';
import csurf from 'csurf';
import cookieParser from 'cookie-parser';
import { Server, Socket } from 'socket.io';

import { encode, decodeMulti } from '@msgpack/msgpack';

const port = 9000;

const app = createApplication();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true }
});

app.use(cors());
app.use(helmet());
app.use(cookieParser());
app.use(csurf({ cookie: true }));
app.use(express.static(path.resolve('../client')));

let count = 0;

function doNvimCall(
  client: net.Socket,
  fn: string,
  params: any[],
  callbackFactory?: (id: number) => (data: any) => void
): void {
  if (callbackFactory) {
    client.on('msgdata', callbackFactory(count));
  }

  const data = encode([0, count, fn, params]);
  client.write(data);
  count += 1;
}

function createBuffer(client: net.Socket): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    doNvimCall(client, 'nvim_create_buf', [false, true], (id: number) => {
      const callback = function (msg: any[]) {
        const msgtype = msg[0];
        if (msgtype !== 1) {
          return;
        }
        const msgid = msg[1];
        if (msgid !== id) {
          return;
        }
        client.off('msgdata', callback);

        if (msg[2] === null) {
          resolve(msg[3]);
        } else {
          reject(msg[2]);
        }
      };
      return callback;
    });
  });
}

function setCurrentBuffer(client: net.Socket, bufid: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    doNvimCall(client, 'nvim_set_current_buf', [bufid], (id: number) => {
      const callback = function (msg: any[]) {
        const msgtype = msg[0];
        if (msgtype !== 1) {
          return;
        }
        const msgid = msg[1];
        if (msgid !== id) {
          return;
        }
        client.off('msgdata', callback);

        if (msg[2] === null) {
          resolve();
        } else {
          reject(msg[2]);
        }
      };
      return callback;
    });
  });
}

function attachUI(
  client: net.Socket,
  socket: Socket,
  width: number,
  height: number
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const options = { ext_linegrid: true };
    doNvimCall(
      client,
      'nvim_ui_attach',
      [width, height, options],
      (id: number) => {
        const callback = function (msg: any[]) {
          const msgtype = msg[0];
          if (msgtype !== 1) {
            return;
          }
          const msgid = msg[1];
          if (msgid !== id) {
            return;
          }
          client.off('msgdata', callback);

          if (msg[2] === null) {
            resolve();
          } else {
            reject(msg[2]);
          }
        };
        return callback;
      }
    );
  });
}

function sendKeys(client: net.Socket, keys: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    doNvimCall(client, 'nvim_input', [keys], (id: number) => {
      const callback = function (msg: any[]) {
        const msgtype = msg[0];
        if (msgtype !== 1) {
          return;
        }
        const msgid = msg[1];
        if (msgid !== id) {
          return;
        }
        client.off('msgdata', callback);

        if (msg[2] === null) {
          resolve();
        } else {
          reject(msg[2]);
        }
      };
      return callback;
    });
  });
}

function setOption(
  client: net.Socket,
  name: string,
  value: any
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    doNvimCall(client, 'nvim_set_option', [name, value], (id: number) => {
      const callback = function (msg: any[]) {
        const msgtype = msg[0];
        if (msgtype !== 1) {
          return;
        }
        const msgid = msg[1];
        if (msgid !== id) {
          return;
        }
        client.off('msgdata', callback);

        if (msg[2] === null) {
          resolve();
        } else {
          reject(msg[2]);
        }
      };
      return callback;
    });
  });
}

function doNvimLoop(socket: Socket, child: ChildProcess) {
  const client = net.createConnection({ host: 'localhost', port: 9001 });

  client.on('connect', async () => {
    console.log('[connected to nvim]');

    socket.on('disconnect', reason => {
      doNvimCall(client, 'nvim_ui_detach', []);
      client.end();
    });

    client.on('data', data => {
      for (const item of decodeMulti(data)) {
        client.emit('msgdata', item);
      }
    });

    client.on('msgdata', (msg: any[]) => {
      const msgtype: number = msg[0];
      if (msgtype !== 2) {
        return;
      }
      socket.emit('notify', msg);
    });

    client.on('end', () => {
      console.log('[disconnected from nvim]');
      child.kill('SIGTERM');
      console.log('[stopped nvim]');
    });

    const response = await createBuffer(client);
    const bufid = response.data[0];
    await setCurrentBuffer(client, bufid);
    await setOption(client, 'laststatus', 0);
    await attachUI(client, socket, 80, 20);

    socket.on('key', async k => {
      await sendKeys(client, k);
    });
  });

  client.on('error', async e => {
    console.log('[connection error]');
    await new Promise(r => setTimeout(r, 10));
    console.log('[trying again]');
    child.emit('spawn');
  });
}

io.on('connection', socket => {
  console.log('[connection event]');

  const args = ['-m', '-n', '--headless', '--listen', 'localhost:9001'];
  const child = spawn('/usr/bin/nvim', args);

  child.on('spawn', () => {
    console.log('[started nvim]');
    doNvimLoop(socket, child);
  });
});

server.listen(port, () => {
  console.log(`running on port ${port}`); // eslint-disable-line security-node/detect-crlf
});

// vim: set ft=typescript:
