import express from 'express';
import { readFileSync, writeFileSync } from 'fs';

interface APTally {
  checksRcvd: Array<number>;
  checksSent: Array<number>;
  total: number;
}

class Keeper {
  private readonly app;
  private readonly srv;

  private ckTotal:APTally;
  private ckSinceLast:APTally;
  //private ckSinceLastHasAny = false;

  private get ckSinceLastHasAny() : boolean {
    return this.ckSinceLast.total > 0;
  }

  constructor() {
    const SRV_PORT = process.env.SRV_PORT ? Number.parseInt(process.env.SRV_PORT) : 22422;

    this.ckTotal = JSON.parse(readFileSync('checkcount.json').toString());
    this.ckSinceLast = {
      checksRcvd: Array(12).fill(0),
      checksSent: Array(12).fill(0),
      total: 0
    };

    this.app = express();
    this.app.get('/', (_, rs) => {
      rs.contentType('text/plain');
      rs.header('Cache-Control', 'no-cache,no-store');
      rs.send('running');
    });
    this.app.get('/total', (_, rs) => {
      rs.contentType('application/json');
      rs.header('Cache-Control', 'no-cache,no-store');
      rs.send(JSON.stringify(this.ckTotal));
    });
    this.app.get('/sincelast', (_, rs) => {
      if (this.ckSinceLastHasAny) {
        rs.contentType('application/json');
        rs.header('Cache-Control', 'no-cache,no-store');
        rs.send(JSON.stringify(this.ckSinceLast));
        this.ckSinceLast = {
          checksRcvd: Array(12).fill(0),
          checksSent: Array(12).fill(0),
          total: 0
        };
        //this.ckSinceLastHasAny = false;
      } else {
        rs.status(204);
        rs.send();
      }
    });
    this.srv = this.app.listen(SRV_PORT);
  }

  public check(sent:number, rcvd:number) {
    sent = Math.round(sent), rcvd = Math.round(rcvd);
    if (sent < 0 || sent >= 12) throw RangeError(`sent value out of range 0-11 (${sent})`);
    if (rcvd < 0 || rcvd >= 12) throw RangeError(`rcvd value out of range 0-11 (${rcvd})`);
    this.ckTotal.checksRcvd[rcvd]++;
    this.ckTotal.checksSent[sent]++;
    this.ckTotal.total++;
    this.ckSinceLast.checksRcvd[rcvd]++;
    this.ckSinceLast.checksSent[sent]++;
    this.ckSinceLast.total++;
    //this.ckSinceLastHasAny = true;
    writeFileSync('checkcount.json', JSON.stringify(this.ckTotal));
  }

  public close() {
    this.srv.close();
  }
}

export { APTally, Keeper };
