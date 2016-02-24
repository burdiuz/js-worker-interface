/**
 * Created by Oleg Galaburda on 23.02.16.
 */
var Scripts = {
  INTERFACE_SRC: {$= ../worker-interface.temp.js},
  SELF_SRC: {$= worker-self.js}
};
eval(Scripts.INTERFACE_SRC);
