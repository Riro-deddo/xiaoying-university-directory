import { describe, expect, it } from 'vitest';
import { missingRequiredText } from '../scripts/source-identity.mjs';

describe('page identity anchors', () => {
  it('matches anchors in normalized visible HTML text', () => {
    const html = `<!doctype html>
      <html>
        <head><title>This title is not an identity anchor</title></head>
        <body>
          <h1>POSTGRADUATE\u3000COURSES</h1>
          <p>Find <span>your</span> course</p>
          <h2>Research</h2><p>degrees</p>
        </body>
      </html>`;

    expect(missingRequiredText(html, [
      'postgraduate courses',
      '  find your   course ',
      'research degrees',
    ])).toEqual([]);
  });

  it('returns every missing anchor in registry order', () => {
    expect(missingRequiredText('<h1>Postgraduate courses</h1>', [
      'Postgraduate',
      'Course finder',
      'Research degrees',
    ])).toEqual(['Course finder', 'Research degrees']);
  });

  it('does not accept an anchor when the body root is hidden', () => {
    expect(missingRequiredText(
      '<html><body hidden><h1>Postgraduate courses</h1></body></html>',
      ['Postgraduate courses'],
    )).toEqual(['Postgraduate courses']);
  });

  it('does not accept an anchor when the html root is hidden', () => {
    expect(missingRequiredText(
      '<html hidden><body><h1>Postgraduate courses</h1></body></html>',
      ['Postgraduate courses'],
    )).toEqual(['Postgraduate courses']);
  });

  it('finds a visible anchor in a body-only document', () => {
    expect(missingRequiredText(
      '<body><h1>Postgraduate courses</h1></body>',
      ['Postgraduate courses'],
    )).toEqual([]);
  });

  it('ignores a title-only anchor while retaining visible main text in a fragment', () => {
    expect(missingRequiredText(
      '<title>Postgraduate courses</title><main>Welcome</main>',
      ['Postgraduate courses', 'Welcome'],
    )).toEqual(['Postgraduate courses']);
  });

  it('ignores a head title while retaining its sibling main text in a fragment', () => {
    expect(missingRequiredText(
      '<head><title>Postgraduate courses</title></head><main>Welcome</main>',
      ['Postgraduate courses', 'Welcome'],
    )).toEqual(['Postgraduate courses']);
  });

  it('does not accept anchors found only in scripts, styles, or hidden markup', () => {
    const html = `<!doctype html>
      <html>
        <head><title>Title only anchor</title></head>
        <body>
          <script>window.payload = 'Script only anchor';</script>
          <style>.label::after { content: 'Style only anchor'; }</style>
          <noscript>Noscript only anchor</noscript>
          <template>Template only anchor</template>
          <section hidden><span>Hidden ancestor anchor</span></section>
          <section aria-hidden="true"><span>Aria ancestor anchor</span></section>
          <section style="display: none"><span>Display ancestor anchor</span></section>
          <section style="visibility:hidden"><span>Visibility ancestor anchor</span></section>
          <main>Visible\u3000body <span>anchor</span></main>
        </body>
      </html>`;

    expect(missingRequiredText(html, [
      'Title only anchor',
      'Script only anchor',
      'Style only anchor',
      'Noscript only anchor',
      'Template only anchor',
      'Hidden ancestor anchor',
      'Aria ancestor anchor',
      'Display ancestor anchor',
      'Visibility ancestor anchor',
      'visible body anchor',
    ])).toEqual([
      'Title only anchor',
      'Script only anchor',
      'Style only anchor',
      'Noscript only anchor',
      'Template only anchor',
      'Hidden ancestor anchor',
      'Aria ancestor anchor',
      'Display ancestor anchor',
      'Visibility ancestor anchor',
    ]);
  });
});
