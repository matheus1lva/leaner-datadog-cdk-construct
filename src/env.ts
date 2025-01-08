/*
 * Unless explicitly stated otherwise all files in this repository are licensed
 * under the Apache License Version 2.0.
 *
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2021 Datadog, Inc.
 */

import * as lambda from "aws-cdk-lib/aws-lambda";
import log from "loglevel";
import { DatadogLambdaProps, DatadogLambdaStrictProps } from "./interfaces";

export const AWS_LAMBDA_EXEC_WRAPPER_KEY = "AWS_LAMBDA_EXEC_WRAPPER";
export const AWS_LAMBDA_EXEC_WRAPPER_VAL = "/opt/datadog_wrapper";

export const ENABLE_DD_TRACING_ENV_VAR = "DD_TRACE_ENABLED";
export const ENABLE_DD_ASM_ENV_VAR = "DD_SERVERLESS_APPSEC_ENABLED";
export const ENABLE_XRAY_TRACE_MERGING_ENV_VAR = "DD_MERGE_XRAY_TRACES";
export const INJECT_LOG_CONTEXT_ENV_VAR = "DD_LOGS_INJECTION";
export const LOG_LEVEL_ENV_VAR = "DD_LOG_LEVEL";
export const ENABLE_DD_LOGS_ENV_VAR = "DD_SERVERLESS_LOGS_ENABLED";
export const CAPTURE_LAMBDA_PAYLOAD_ENV_VAR = "DD_CAPTURE_LAMBDA_PAYLOAD";
export const DD_ENV_ENV_VAR = "DD_ENV";
export const DD_SERVICE_ENV_VAR = "DD_SERVICE";
export const DD_VERSION_ENV_VAR = "DD_VERSION";
export const DD_TAGS = "DD_TAGS";
export const DD_COLD_START_TRACING = "DD_COLD_START_TRACING";
export const DD_MIN_COLD_START_DURATION = "DD_MIN_COLD_START_DURATION";
export const DD_COLD_START_TRACE_SKIP_LIB = "DD_COLD_START_TRACE_SKIP_LIB";
export const DD_PROFILING_ENABLED = "DD_PROFILING_ENABLED";
export const DD_ENCODE_AUTHORIZER_CONTEXT = "DD_ENCODE_AUTHORIZER_CONTEXT";
export const DD_DECODE_AUTHORIZER_CONTEXT = "DD_DECODE_AUTHORIZER_CONTEXT";
export const DD_APM_FLUSH_DEADLINE_MILLISECONDS = "DD_APM_FLUSH_DEADLINE_MILLISECONDS";

const execSync = require("child_process").execSync;

const URL = require("url").URL;

export function setGitEnvironmentVariables(lambdas: any[]): void {
  log.debug("Adding source code integration...");
  const { hash, gitRepoUrl } = getGitData();

  if (hash == "" || gitRepoUrl == "") return;

  // We're using an any type here because AWS does not expose the `environment` field in their type
  lambdas.forEach((lam) => {
    if (lam.environment[DD_TAGS] !== undefined) {
      lam.environment[DD_TAGS].value += `,git.commit.sha:${hash}`;
    }
  });
}

function getGitData(): { hash: string; gitRepoUrl: string } {
  let hash: string;
  let gitRepoUrl: string;

  try {
    hash = execSync("git rev-parse HEAD").toString().trim();
    gitRepoUrl = execSync("git config --get remote.origin.url").toString().trim();
  } catch (e) {
    log.debug(`Failed to add source code integration. Error: ${e}`);
    return { hash: "", gitRepoUrl: "" };
  }
  return { hash, gitRepoUrl: filterAndFormatGithubRemote(gitRepoUrl) };
}

// Removes sensitive info from the given git remote url and normalizes the url prefix.
// "git@github.com:" and "https://github.com/" prefixes will be normalized into "github.com/"
function filterAndFormatGithubRemote(rawRemote: string): string {
  rawRemote = filterSensitiveInfoFromRepository(rawRemote);
  if (!rawRemote) {
    return rawRemote;
  }
  rawRemote = rawRemote.replace(/git@github\.com:|https:\/\/github\.com\//, "github.com/");

  return rawRemote;
}

function filterSensitiveInfoFromRepository(repositoryUrl: string): string {
  try {
    if (!repositoryUrl) {
      return repositoryUrl;
    }
    if (repositoryUrl.startsWith("git@")) {
      return repositoryUrl;
    }
    const { protocol, hostname, pathname } = new URL(repositoryUrl);
    if (!protocol || !hostname) {
      return repositoryUrl;
    }

    return `${protocol}//${hostname}${pathname}`;
  } catch (e) {
    return repositoryUrl;
  }
}

export function applyEnvVariables(lam: lambda.Function, baseProps: DatadogLambdaStrictProps): void {
  log.debug(`Setting environment variables...`);
  lam.addEnvironment(ENABLE_DD_TRACING_ENV_VAR, baseProps.enableDatadogTracing.toString().toLowerCase());
  lam.addEnvironment(ENABLE_DD_LOGS_ENV_VAR, baseProps.enableDatadogLogs.toString().toLowerCase());
}

export function setDDEnvVariables(lam: lambda.Function, props: DatadogLambdaProps): void {
  if (props.env) {
    lam.addEnvironment(DD_ENV_ENV_VAR, props.env);
  }
  if (props.service) {
    lam.addEnvironment(DD_SERVICE_ENV_VAR, props.service);
  }
}
