import * as ts from "typescript";
import * as tstl from "typescript-to-lua";
import { createSerialDiagnosticFactory } from "typescript-to-lua/dist/utils";

//#region Courtesy of TSTL codebase :-)
// https://github.com/TypeScriptToLua/TypeScriptToLua/blob/master/src/transformation/utils/diagnostics.ts

type MessageProvider<TArgs extends any[]> = string | ((...args: TArgs) => string);

const createDiagnosticFactory = <TArgs extends any[]>(
  category: ts.DiagnosticCategory,
  message: MessageProvider<TArgs>
) =>
  createSerialDiagnosticFactory((node: ts.Node, ...args: TArgs) => ({
    file: ts.getOriginalNode(node).getSourceFile(),
    start: ts.getOriginalNode(node).getStart(),
    length: ts.getOriginalNode(node).getWidth(),
    messageText: typeof message === "string" ? message : message(...args),
    category,
  }));

const createErrorDiagnosticFactory = <TArgs extends any[]>(message: MessageProvider<TArgs>) =>
  createDiagnosticFactory(ts.DiagnosticCategory.Error, message);
const createWarningDiagnosticFactory = <TArgs extends any[]>(message: MessageProvider<TArgs>) =>
  createDiagnosticFactory(ts.DiagnosticCategory.Warning, message);

const getLuaTargetName = (version: tstl.LuaTarget) => (version === tstl.LuaTarget.LuaJIT ? "LuaJIT" : `Lua ${version}`);
const unsupportedForTarget = createErrorDiagnosticFactory(
  (functionality: string, version: tstl.LuaTarget) =>
    `${functionality} is/are not supported for target ${getLuaTargetName(version)}.`
);

//#endregion

const expectedStringLiteralInGoto = createErrorDiagnosticFactory(
  "Expected a string literal in '__goto'."
);

const expectedFunctionExpressionInInline = createErrorDiagnosticFactory(
  "Expected a function expression in '__inline'."
);

const expectedStringLiteralInLabel = createErrorDiagnosticFactory(
  "Expected a string literal in '__label'."
);

const expectedAnArgumentInUnsafeCast = createErrorDiagnosticFactory(
  "Expected a value in 'unsafe_cast'."
);

const expectedClassTypeNameInMethodsOf = createErrorDiagnosticFactory(
  "Expected a class type name in '__methodsof'."
);

const expectedAnArgumentInNext = createErrorDiagnosticFactory(
  "Expected an object in '__next'."
);

const expectedClassTypeNameInPrototypeOf = createErrorDiagnosticFactory(
  "Expected a class type name in '__prototypeof'."
);

const expectedAssignmentLHSExpressionInSwap = createErrorDiagnosticFactory(
  "Expected an assignment LHS expression in '__swap'."
);

const typedParamsUsedOutsideOfFunction = createErrorDiagnosticFactory(
  "'__typedparams' can not be used outside a function."
);

interface PluginOptions {
  hasContinue: boolean;
}

let pluginOptions: Partial<PluginOptions> = {};

const plugin: tstl.Plugin = {
  beforeTransform(program, options, emitHost) {
    try {
      const settings = options.luaPlugins!.find((v) => v.name === "@cheatoid/tstl-extensions/index.js") as
        (tstl.LuaPluginImport & Partial<PluginOptions>) | undefined;
      pluginOptions = {
        hasContinue: settings?.hasContinue === true,
      };
    } catch {
      // ignored
    }
  },
  visitors: {
    [ts.SyntaxKind.CallExpression](node, context) {
      const result = context.superTransformExpression(node);
      if (tstl.isCallExpression(result) && tstl.isIdentifier(result.expression)) {
        switch (result.expression.text) {
          case "unsafe_cast": {
            if (result.params.length === 1) {
              return result.params[0];
            }
            context.diagnostics.push(expectedAnArgumentInUnsafeCast(node));
            break;
          }
          case "__vararg": {
            return tstl.createDotsLiteral(node);
          }
        }
      }
      return result;
    },
    [ts.SyntaxKind.ExpressionStatement](node, context) {
      const result = context.superTransformStatements(node);
      if (ts.isExpressionStatement(node)) {
        const expr = node.expression;
        if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
          switch (expr.expression.text) {
            case "__goto": {
              if (context.luaTarget === tstl.LuaTarget.Lua50 || context.luaTarget === tstl.LuaTarget.Lua51) {
                context.diagnostics.push(unsupportedForTarget(node, "goto", context.luaTarget));
                break;
              }
              if (expr.arguments.length === 1 && ts.isStringLiteral(expr.arguments[0])) {
                return tstl.createGotoStatement(expr.arguments[0].text, node);
              }
              context.diagnostics.push(expectedStringLiteralInGoto(node));
              break;
            }
            case "__inline": {
              if (expr.arguments.length > 0) {
                let bodyArg: ts.Expression | ts.Declaration | undefined = expr.arguments[0];
                if (ts.isIdentifier(bodyArg)) {
                  try {
                    bodyArg = context.checker.getSymbolAtLocation(bodyArg)!.getDeclarations()![0];
                  } catch (error) {
                    context.diagnostics.push(expectedFunctionExpressionInInline(node));
                    break;
                  }
                  if (!bodyArg) {
                    context.diagnostics.push(expectedFunctionExpressionInInline(node));
                    break;
                  }
                }
                const paramNames: string[] = [];
                let funcExpr: tstl.FunctionExpression | undefined;
                if (ts.isFunctionLike(bodyArg)) {
                  const bodyNode: tstl.Node | undefined = context.transformNode(bodyArg)[0];
                  if (!bodyNode) {
                    context.diagnostics.push(expectedFunctionExpressionInInline(node));
                    break;
                  }
                  if (tstl.isVariableDeclarationStatement(bodyNode) && bodyNode.right) {
                    if (tstl.isFunctionExpression(bodyNode.right[0])) {
                      funcExpr = bodyNode.right[0];
                    }
                  }
                  paramNames.push(...bodyArg.parameters.map(p => p.name.getText()));
                }
                for (const stmt of result) {
                  if (tstl.isExpressionStatement(stmt)) {
                    const callExpr = stmt.expression;
                    if (tstl.isCallExpression(callExpr) && tstl.isIdentifier(callExpr.expression) &&
                      callExpr.expression.text === expr.expression.text) {
                      const paramCount = callExpr.params.length;
                      if (paramCount > 0) {
                        let body: tstl.Expression | undefined = callExpr.params[0];
                        if (tstl.isIdentifier(body)) {
                          body = funcExpr;
                        }
                        if (body && tstl.isFunctionExpression(body)) {
                          const statements: tstl.Statement[] = body.body.statements;
                          for (let index = 1; index < paramCount; ++index) { // Skip the body parameter.
                            const param = callExpr.params[index];
                            statements.unshift(
                              tstl.createVariableDeclarationStatement([tstl.createIdentifier(paramNames[index - 1])], [param])
                            );
                          }
                          return tstl.createDoStatement(statements, node);
                        }
                      }
                    }
                  }
                }
              }
              context.diagnostics.push(expectedFunctionExpressionInInline(node));
              break;
            }
            case "__label": {
              if (context.luaTarget === tstl.LuaTarget.Lua50 || context.luaTarget === tstl.LuaTarget.Lua51) {
                context.diagnostics.push(unsupportedForTarget(node, "label", context.luaTarget));
                break;
              }
              if (expr.arguments.length === 1 && ts.isStringLiteral(expr.arguments[0])) {
                return tstl.createLabelStatement(expr.arguments[0].text, node);
              }
              context.diagnostics.push(expectedStringLiteralInLabel(node));
              break;
            }
            case "__return": {
              for (const stmt of result) {
                if (tstl.isExpressionStatement(stmt)) {
                  const callExpr = stmt.expression;
                  if (tstl.isCallExpression(callExpr) && tstl.isIdentifier(callExpr.expression) &&
                    callExpr.expression.text === expr.expression.text) {
                    return tstl.createReturnStatement(callExpr.params, node);
                  }
                }
              }
              break;
            }
            case "__swap": {
              if (expr.arguments.length === 2) {
                for (const stmt of result) {
                  if (tstl.isExpressionStatement(stmt)) {
                    const callExpr = stmt.expression;
                    if (tstl.isCallExpression(callExpr) && tstl.isIdentifier(callExpr.expression) &&
                      callExpr.expression.text === expr.expression.text) {
                      if (tstl.isAssignmentLeftHandSideExpression(callExpr.params[0]) && tstl.isAssignmentLeftHandSideExpression(callExpr.params[1])) {
                        return tstl.createAssignmentStatement([callExpr.params[0], callExpr.params[1]], [callExpr.params[1], callExpr.params[0]], node);
                      }
                      context.diagnostics.push(expectedAssignmentLHSExpressionInSwap(node));
                      break;
                    }
                  }
                }
              }
              break;
            }
            case "__typedparams": {
              // TODO: Consider supporting any depth within function
              if (ts.isBlock(node.parent) && ts.isFunctionLike(node.parent.parent) && expr.arguments.length === 1) {
                const typedParams: tstl.TableExpression[] = [];
                for (const param of node.parent.parent.parameters) {
                  // /*parameter name*/string, /*full type*/string, /*dotDotDotToken*/boolean, /*questionToken*/boolean, /*type*/string, /*initializer*/string?
                  const paramEntry: tstl.Expression[] = [
                    tstl.createStringLiteral(param.name.getText()),
                    tstl.createStringLiteral(`${param.dotDotDotToken?.getText() ?? ""}${param.type?.getText() ?? "any"}${param.questionToken ? "?" : ""}`),
                    tstl.createBooleanLiteral(param.dotDotDotToken ? true : false),
                    tstl.createBooleanLiteral(param.questionToken ? true : false),
                    tstl.createStringLiteral(param.type?.getText() ?? "any")
                  ];
                  if (param.initializer) {
                    paramEntry.push(
                      tstl.createStringLiteral(param.initializer.getText())
                    );
                  }
                  typedParams.push(
                    tstl.createTableExpression([...paramEntry.map((e) => tstl.createTableFieldExpression(e))])
                  );
                }
                for (const stmt of result) {
                  if (tstl.isExpressionStatement(stmt)) {
                    const callExpr = stmt.expression;
                    if (tstl.isCallExpression(callExpr) && tstl.isIdentifier(callExpr.expression) &&
                      callExpr.expression.text === expr.expression.text && callExpr.params.length === 1) {
                      return tstl.createExpressionStatement(tstl.createCallExpression(callExpr.params[0], typedParams), node);
                    }
                  }
                }
              }
              context.diagnostics.push(typedParamsUsedOutsideOfFunction(node));
              break;
            }
          }
        }
      }
      return result;
    },
    [ts.SyntaxKind.ForOfStatement](node, context) {
      const result = context.superTransformStatements(node);
      const expr = node.expression;
      if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) && ts.isBlock(node.statement)) {
        switch (expr.expression.text) {
          case "__methodsof": {
            if (expr.typeArguments && expr.typeArguments.length === 1) {
              const typeArg = expr.typeArguments[0];
              if (ts.isTypeReferenceNode(typeArg)) {
                const typeInfo = context.checker.getTypeAtLocation(typeArg); // Thanks Perry 😎
                if (typeInfo.isClass()) {
                  const escapedName = typeInfo.symbol.escapedName.toString();
                  for (const stmt of result) {
                    if (tstl.isForInStatement(stmt) && stmt.names.length === 2) {
                      stmt.expressions.splice(0);
                      stmt.expressions.push(tstl.createIdentifier("next"), tstl.createIdentifier(`${escapedName}.prototype`));
                      stmt.body.statements.push(tstl.createIfStatement(
                        tstl.createBinaryExpression(
                          // Skip non functions
                          tstl.createBinaryExpression(
                            tstl.createCallExpression(tstl.createIdentifier("type"), [stmt.names[1]]),
                            tstl.createStringLiteral("function"),
                            tstl.SyntaxKind.EqualityOperator
                          ),
                          // Skip metamethods (and constructor)
                          tstl.createBinaryExpression(
                            tstl.createCallExpression(tstl.createIdentifier("string.sub"), [stmt.names[0], tstl.createNumericLiteral(1), tstl.createNumericLiteral(2)]),
                            tstl.createStringLiteral("__"),
                            tstl.SyntaxKind.InequalityOperator
                          ),
                          tstl.SyntaxKind.AndOperator
                        ),
                        tstl.createBlock(stmt.body.statements.splice(0))
                      ));
                    }
                  }
                  break;
                }
              }
            }
            context.diagnostics.push(expectedClassTypeNameInMethodsOf(node));
            break;
          }
          case "__next": {
            for (const stmt of result) {
              if (tstl.isForInStatement(stmt)) {
                const spliced = stmt.expressions.splice(0);
                if (spliced.length === 1) {
                  const callExpr = spliced[0];
                  if (tstl.isCallExpression(callExpr)) {
                    stmt.expressions.push(tstl.createIdentifier("next"), ...callExpr.params);
                    continue;
                  }
                }
                context.diagnostics.push(expectedAnArgumentInNext(node));
                break;
              }
            }
            break;
          }
          case "__prototypeof": { // Stripped down version of __methodsof
            if (expr.typeArguments && expr.typeArguments.length === 1) {
              const typeArg = expr.typeArguments[0];
              if (ts.isTypeReferenceNode(typeArg)) {
                const typeInfo = context.checker.getTypeAtLocation(typeArg); // Thanks Perry 😎
                if (typeInfo.isClass()) {
                  const escapedName = typeInfo.symbol.escapedName.toString();
                  for (const stmt of result) {
                    if (tstl.isForInStatement(stmt)) {
                      stmt.expressions.splice(0);
                      stmt.expressions.push(tstl.createIdentifier("next"), tstl.createIdentifier(`${escapedName}.prototype`));
                    }
                  }
                  break;
                }
              }
            }
            context.diagnostics.push(expectedClassTypeNameInPrototypeOf(node));
            break;
          }
        }
      }
      return result;
    },
    [ts.SyntaxKind.ContinueStatement](node, context) {
      if (pluginOptions.hasContinue) {
        return tstl.createExpressionStatement(tstl.createIdentifier("continue", node), node);
      }
      return context.superTransformStatements(node);
    }
  }
};

export default plugin;
