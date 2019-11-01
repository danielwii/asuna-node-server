import { Connection } from 'typeorm';

export class ConnectionHelper {
  public static _ = new ConnectionHelper();

  private dbConnection: Connection;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  set connection(connection: Connection) {
    if (!this.dbConnection) {
      this.dbConnection = connection;
    }
  }

  get connection() {
    return this.dbConnection;
  }
}
