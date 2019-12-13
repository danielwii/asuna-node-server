import { BaseEntity, Column, CreateDateColumn, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export class Device extends BaseEntity {
  @PrimaryColumn({ length: 36 })
  uuid: string;

  @Column({ nullable: true, length: 10 })
  version: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
