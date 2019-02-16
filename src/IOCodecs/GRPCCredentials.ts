import * as GRPC from 'grpc'
import * as t from 'io-ts'

// tslint:disable-next-line:no-submodule-imports no-var-requires
const { ChannelCredentials } = require('grpc/src/grpc_extension')

const isCredentialsObject = (u: unknown): u is GRPC.ChannelCredentials =>
  u instanceof ChannelCredentials

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
