/**
 * Created by Oleg Galaburda on 23.02.16.
 */

var Scripts = {
  DEPS_SRC: {$= ../worker-interface-deps.temp.js},
  INTERFACE_SRC: {$= worker-interface.js},
  SELF_SRC: {$= worker-self.js}
};
eval(Scripts.DEPS_SRC + Scripts.INTERFACE_SRC);
