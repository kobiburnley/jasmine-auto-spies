import { Spy } from './spy-types';

import { Observable, ReplaySubject } from 'rxjs';

import root from 'window-or-global';

const Reflect = root.Reflect;

export function createSpyFromClass<T>(
  ObjectClass: { new (...args: any[]): T; [key: string]: any },
  providedPromiseMethodNames?: PropertyKey[],
  providedObservableMethodNames?: PropertyKey[]
): Spy<T> {
  const proto = ObjectClass.prototype;

  const spies: Map<PropertyKey, Spy<T>> = new Map();

  return new Proxy({} as Spy<T>, {
    get: (target, p) => {
      if (spies.has(p)) {
        return spies.get(p);
      }

      const returnTypeClass = Reflect.getMetadata(
        'design:returntype',
        proto,
        p
      );

      const methodName = String(p);

      let spyFunction;

      if (
        (providedPromiseMethodNames &&
          providedPromiseMethodNames.indexOf(methodName) !== -1) ||
        returnTypeClass === Promise
      ) {
        spyFunction = createPromiseSpyFunction(methodName);
      } else if (
        (providedObservableMethodNames &&
          providedObservableMethodNames.indexOf(methodName) !== -1) ||
        returnTypeClass === Observable
      ) {
        spyFunction = createObservableSpyFunction(methodName);
      } else {
        spyFunction = jasmine.createSpy(methodName);
      }

      spies.set(p, spyFunction);

      return spyFunction;
    }
  });
}

function createObservableSpyFunction(name: string) {
  const spyFunction: any = jasmine.createSpy(name);
  const subject: ReplaySubject<any> = new ReplaySubject(1);

  spyFunction.and.returnValue(subject);
  spyFunction.and.nextWith = function nextWith(value: any) {
    subject.next(value);
  };

  spyFunction.and.throwWith = function throwWith(value: any) {
    subject.error(value);
  };

  spyFunction.and.complete = function complete() {
    subject.complete();
  };

  return spyFunction;
}

function createPromiseSpyFunction(name: string) {
  const spyFunction: any = jasmine.createSpy(name);

  spyFunction.and.returnValue(
    new Promise<any>((resolveWith, rejectWith) => {
      spyFunction.and.resolveWith = resolveWith;
      spyFunction.and.rejectWith = rejectWith;
    })
  );

  return spyFunction;
}

function getAllMethodNames(obj: any) {
  let methods: string[] = [];

  do {
    methods = methods.concat(Object.keys(obj));
    obj = Object.getPrototypeOf(obj);
  } while (obj);

  const constructorIndex = methods.indexOf('constructor');
  if (constructorIndex >= 0) {
    methods.splice(constructorIndex, 1);
  }

  // .filter(methodName => typeof proto[methodName] == 'function')
  return methods;
}
