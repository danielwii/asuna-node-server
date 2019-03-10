import { EntityRepository, Repository } from 'typeorm';

import { Role } from './auth.entities';

@EntityRepository(Role)
export class RoleRepository extends Repository<Role> {
  findByNames(names: string[]) {
    return this.createQueryBuilder('role')
      .where('role.name IN (:names)', { names })
      .getMany();
  }
}
