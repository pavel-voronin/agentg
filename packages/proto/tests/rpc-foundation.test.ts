import { Server } from '@grpc/grpc-js';
import { describe, expect, it } from 'vitest';

import {
  HealthServiceClient,
  HealthServiceService,
  type HealthCheckResponse,
  type HealthServiceServer
} from '../src/generated/agentg/internal/v1/health.js';
import {
  createInsecureInternalRpcCredentials,
  createInsecureInternalRpcServerCredentials,
  createInternalRpcCallOptions,
  createInternalRpcMetadata,
  readInternalRpcCorrelationId
} from '../src/rpc/grpc.js';

describe('gRPC foundation', () => {
  it('performs a generated client/server round trip', async () => {
    const server = new Server();
    const service: HealthServiceServer = {
      check(call, callback) {
        callback(null, {
          service: call.request.service,
          status: readInternalRpcCorrelationId(call.metadata) ?? 'missing-correlation-id'
        });
      }
    };

    server.addService(HealthServiceService, service);

    const port = await bindEphemeral(server);
    const client = new HealthServiceClient(
      `127.0.0.1:${String(port)}`,
      createInsecureInternalRpcCredentials()
    );

    try {
      const response = await checkHealth(client);

      expect(response).toEqual({
        service: 'rpc-foundation',
        status: 'stage-1'
      });
    } finally {
      client.close();
      await shutdown(server);
    }
  });
});

function bindEphemeral(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.bindAsync('127.0.0.1:0', createInsecureInternalRpcServerCredentials(), (error, port) => {
      if (error !== null) {
        reject(error);
        return;
      }

      resolve(port);
    });
  });
}

function checkHealth(client: HealthServiceClient): Promise<HealthCheckResponse> {
  return new Promise((resolve, reject) => {
    client.check(
      {
        service: 'rpc-foundation'
      },
      createInternalRpcMetadata({ correlationId: 'stage-1' }),
      createInternalRpcCallOptions(1000),
      (error, response) => {
        if (error !== null) {
          reject(error);
          return;
        }

        resolve(response);
      }
    );
  });
}

function shutdown(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.tryShutdown((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
