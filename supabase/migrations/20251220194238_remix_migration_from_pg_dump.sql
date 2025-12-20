CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: create_default_templates_for_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_default_templates_for_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.mensagens_template (user_id, tipo, mensagem, ativo) VALUES
  (NEW.id, '24h', 'Olá! Este é um lembrete de que você tem um agendamento na Barbearia Marco Túlio amanhã às {hora_agendada}. Serviço: {servico}. Nos vemos em breve!', true),
  (NEW.id, '1h', 'Olá! Seu horário na Barbearia Marco Túlio é daqui a 1 hora ({hora_agendada}). Serviço: {servico}. Estamos te esperando!', true);
  
  RETURN NEW;
END;
$$;


--
-- Name: get_email_by_username(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_email_by_username(_username text) RETURNS text
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT au.email
  FROM auth.users au
  INNER JOIN public.profiles p ON p.user_id = au.id
  WHERE p.username = _username
  LIMIT 1;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: agendamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agendamentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_evento text NOT NULL,
    nome_cliente text NOT NULL,
    datetime_start timestamp with time zone NOT NULL,
    datetime_end timestamp with time zone NOT NULL,
    dia_agendado_formatado text NOT NULL,
    dia_agendado date NOT NULL,
    hora_agendada text NOT NULL,
    hora_final text NOT NULL,
    link_evento text NOT NULL,
    servico text NOT NULL,
    tempo_total_minutos integer NOT NULL,
    status_evento text NOT NULL,
    evento_recorrente text NOT NULL,
    notificacao_24h_enviada boolean DEFAULT false,
    notificacao_1h_enviada boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    telefone_cliente text
);


--
-- Name: historico_mensagens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historico_mensagens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agendamento_id uuid NOT NULL,
    nome_cliente text NOT NULL,
    tipo_notificacao text NOT NULL,
    mensagem_enviada text NOT NULL,
    enviado_em timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'enviada'::text NOT NULL
);


--
-- Name: mensagens_template; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mensagens_template (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo text NOT NULL,
    mensagem text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id uuid,
    CONSTRAINT mensagens_template_tipo_check CHECK ((tipo = ANY (ARRAY['24h'::text, '1h'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    username text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agendamentos agendamentos_id_evento_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT agendamentos_id_evento_key UNIQUE (id_evento);


--
-- Name: agendamentos agendamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT agendamentos_pkey PRIMARY KEY (id);


--
-- Name: historico_mensagens historico_mensagens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico_mensagens
    ADD CONSTRAINT historico_mensagens_pkey PRIMARY KEY (id);


--
-- Name: mensagens_template mensagens_template_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensagens_template
    ADD CONSTRAINT mensagens_template_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: idx_agendamentos_datetime_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agendamentos_datetime_start ON public.agendamentos USING btree (datetime_start);


--
-- Name: idx_agendamentos_id_evento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agendamentos_id_evento ON public.agendamentos USING btree (id_evento);


--
-- Name: idx_agendamentos_notificacoes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agendamentos_notificacoes ON public.agendamentos USING btree (notificacao_24h_enviada, notificacao_1h_enviada);


--
-- Name: agendamentos update_agendamentos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_agendamentos_updated_at BEFORE UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: mensagens_template update_mensagens_template_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_mensagens_template_updated_at BEFORE UPDATE ON public.mensagens_template FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: agendamentos agendamentos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT agendamentos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: historico_mensagens historico_mensagens_agendamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historico_mensagens
    ADD CONSTRAINT historico_mensagens_agendamento_id_fkey FOREIGN KEY (agendamento_id) REFERENCES public.agendamentos(id) ON DELETE CASCADE;


--
-- Name: mensagens_template mensagens_template_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensagens_template
    ADD CONSTRAINT mensagens_template_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: agendamentos Users can delete their own agendamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own agendamentos" ON public.agendamentos FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: mensagens_template Users can delete their own templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own templates" ON public.mensagens_template FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: agendamentos Users can insert their own agendamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own agendamentos" ON public.agendamentos FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: historico_mensagens Users can insert their own message history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own message history" ON public.historico_mensagens FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.agendamentos
  WHERE ((agendamentos.id = historico_mensagens.agendamento_id) AND (agendamentos.user_id = auth.uid())))));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: mensagens_template Users can insert their own templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own templates" ON public.mensagens_template FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: agendamentos Users can update their own agendamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own agendamentos" ON public.agendamentos FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: mensagens_template Users can update their own templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own templates" ON public.mensagens_template FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);


--
-- Name: agendamentos Users can view their own agendamentos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own agendamentos" ON public.agendamentos FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: historico_mensagens Users can view their own message history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own message history" ON public.historico_mensagens FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.agendamentos
  WHERE ((agendamentos.id = historico_mensagens.agendamento_id) AND (agendamentos.user_id = auth.uid())))));


--
-- Name: mensagens_template Users can view their own templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own templates" ON public.mensagens_template FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: agendamentos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

--
-- Name: historico_mensagens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.historico_mensagens ENABLE ROW LEVEL SECURITY;

--
-- Name: mensagens_template; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mensagens_template ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;