import { expect, server } from './setup';

describe('Index page test', () => {
  it('gets base url', done => {
    server
      .get(`/`)
      .expect(200)
      .end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.body.message).to.equal(
          'Environment variable is coming across.'
        );
        done();
      });
  });
});