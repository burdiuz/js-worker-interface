/**
 * Created by Oleg Galaburda on 23.02.16.
 */

var Scripts = {
  DEPS_SRC: {$= ../../dependencies.temp.js},
  INTERFACE_SRC: {$= ../../worker-interface.temp.js},
  SELF_SRC: {$= self.js}
};
eval(Scripts.DEPS_SRC + Scripts.INTERFACE_SRC);
