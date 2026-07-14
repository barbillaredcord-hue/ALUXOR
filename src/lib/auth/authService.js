import { supabase } from "../supabase/client";

/** Registra un usuario y guarda su nombre visible como metadata. */
export async function signUp({ email, password, displayName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  });

  return { data, error };
}

/** Inicia sesión mediante correo y contraseña. */
export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
}

/** Cierra la sesión actual. */
export async function signOut() {
  return supabase.auth.signOut();
}

/** Devuelve la sesión persistida o null cuando no existe. */
export async function getSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}

/** Obtiene el usuario validado por Supabase Auth. */
export async function getUser() {
  return supabase.auth.getUser();
}

/** Suscribe un callback a los cambios de autenticación. */
export function onAuthStateChange(callback) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(callback);

  return subscription;
}

export const AuthService = {
  signUp,
  signIn,
  signOut,
  getSession,
  getUser,
  onAuthStateChange,
};
