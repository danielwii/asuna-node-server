import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection, Repository } from 'typeorm';
import { ClientUser } from './client.entities';

@Injectable()
export class ClientService {
  private readonly clientUserRepository: Repository<ClientUser>;

  constructor(@InjectConnection() private readonly connection: Connection) {
    this.clientUserRepository = connection.getRepository(ClientUser);
  }

  createClient(uuid: string): Promise<ClientUser> {
    return this.clientUserRepository.save({ uuid });
  }

  async getClient(uuid: string): Promise<ClientUser> {
    const client = await this.clientUserRepository.findOne({ uuid });
    return client ? client : this.createClient(uuid);
  }
}
