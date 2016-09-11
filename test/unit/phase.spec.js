'use strict';

// Imports
let util = require('util');

// Imports - Local
let Phase = require('../../lib/phase');

// Tests
describe('Phase', () => {
  describe('#constructor()', () => {
    it('should initialize properties with the arguments', () => {
      let phase = new Phase('foo', 'bar', ['baz', 'qux'], 'test');

      expect(phase.id).toBe('foo');
      expect(phase.description).toBe('bar');
      expect(phase.instructions).toEqual(['baz', 'qux']);
      expect(phase.error).toBe('test');
    });

    it('should set a default value for `instructions`', () => {
      let phases = [
        new Phase('foo', 'bar'),
        new Phase('foo', 'bar', undefined),
        new Phase('foo', 'bar', null),
        new Phase('foo', 'bar', false),
        new Phase('foo', 'bar', 0),
        new Phase('foo', 'bar', ''),
      ];

      phases.forEach(phase => {
        expect(phase.instructions).toEqual([]);
      });
    });

    it('should set a default value for `error`', () => {
      let phases = [
        new Phase('foo', 'bar', []),
        new Phase('foo', 'bar', [], undefined),
        new Phase('foo', 'bar', [], null),
        new Phase('foo', 'bar', [], false),
        new Phase('foo', 'bar', [], 0),
        new Phase('foo', 'bar', [], ''),
      ];

      phases.forEach(phase => {
        expect(phase.error).toBeNull();
      });
    });

    describe('- Field validation', () => {
      beforeEach(() => {
        spyOn(Phase.prototype, 'toString').and.returnValue('MockPhase');
      });

      it('should validate `id`', () => {
        let error = null;

        try {
          new Phase() ;
        } catch (err) { error = err; }

        expect(error).toEqual(jasmine.any(Error));
        expect(error.message).toMatch(/missing or invalid field/i);
        expect(error.message).toContain('MockPhase');
        expect(error.message).toContain('id');

        error = null;

        try {
          new Phase(1) ;
        } catch (err) { error = err; }

        expect(error).toEqual(jasmine.any(Error));
        expect(error.message).toMatch(/missing or invalid field/i);
        expect(error.message).toContain('MockPhase');
        expect(error.message).toContain('id');
      });

      it('should validate `description`', () => {
        let error = null;

        try {
          new Phase('') ;
        } catch (err) { error = err; }

        expect(error).toEqual(jasmine.any(Error));
        expect(error.message).toMatch(/missing or invalid field/i);
        expect(error.message).toContain('MockPhase');
        expect(error.message).toContain('description');

        error = null;

        try {
          new Phase('', true) ;
        } catch (err) { error = err; }

        expect(error).toEqual(jasmine.any(Error));
        expect(error.message).toMatch(/missing or invalid field/i);
        expect(error.message).toContain('MockPhase');
        expect(error.message).toContain('description');
      });

      it('should validate `instructions`', () => {
        let error = null;

        try {
          new Phase('', '') ;
        } catch (err) { error = err; }

        expect(error).toBeNull();

        error = null;

        try {
          new Phase('', '', {});
        } catch (err) { error = err; }

        expect(error).toEqual(jasmine.any(Error));
        expect(error.message).toMatch(/missing or invalid field/i);
        expect(error.message).toContain('MockPhase');
        expect(error.message).toContain('instructions');
      });

      it('should validate each `instruction`', () => {
        let error = null;

        try {
          new Phase('', '', ['', null]) ;
        } catch (err) { error = err; }

        expect(error).toEqual(jasmine.any(Error));
        expect(error.message).toMatch(/missing or invalid field/i);
        expect(error.message).toContain('MockPhase');
        expect(error.message).toContain('instruction');
      });

      it('should validate `error`', () => {
        let error = null;

        try {
          new Phase('', '', []) ;
        } catch (err) { error = err; }

        expect(error).toBeNull();

        error = null;

        try {
          new Phase('', '', [], () => {});
        } catch (err) { error = err; }

        expect(error).toEqual(jasmine.any(Error));
        expect(error.message).toMatch(/missing or invalid field/i);
        expect(error.message).toContain('MockPhase');
        expect(error.message).toContain('error');
      });
    });
  });

  describe('#toString()', () => {
    it('should nicely format the instance', () => {
      let phase = new Phase('foo', 'bar', ['baz', 'qux'], 'test');

      expect(phase.toString()).toBe(util.format(phase));
    });
  });
});
