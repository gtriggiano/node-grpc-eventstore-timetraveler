import * as GRPC from 'grpc'
import * as t from 'io-ts'

const isCredentialsObject = (u: unknown): u is GRPC.ChannelCredentials =>
  u instanceof GRPC.ServerCredentials

export const GRPCCredentials = new t.Type<GRPC.ChannelCredentials>(
  'GRPCCredentials',
  isCredentialsObject,
  (u, c) => {
    return isCredentialsObject(u)
      ? t.success(u)
      : t.failure(u, c, 'should be a gRPC credentials object')
  },
  t.identity
)
