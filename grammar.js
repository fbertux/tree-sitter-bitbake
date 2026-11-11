/**
 * @file BitBake grammar for tree-sitter
 * @author Amaan Qureshi <amaanq12@gmail.com>
 * @license MIT
 */

/* eslint-disable arrow-parens */
/* eslint-disable camelcase */
/* eslint-disable-next-line spaced-comment */
/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const {pythonCode, sep1} = require('./python');

module.exports = grammar({
  name: 'bitbake',

  conflicts: $ => [
    [$.primary_expression, $.pattern],
    [$.primary_expression, $.list_splat_pattern],
    [$.tuple, $.tuple_pattern],
    [$.list, $.list_pattern],
    [$.with_item, $._collection_elements],
    [$.named_expression, $.as_pattern],
    [$.print_statement, $.primary_expression],
  ],

  externals: $ => [
    $._concat,

    $._newline,
    $._indent,
    $._dedent,
    $.string_start,
    $._string_content,
    $.escape_interpolation,
    $.string_end,

    // Mark comments as external tokens so that the external scanner is always
    // invoked, even if no external token is expected. This allows for better
    // error recovery, because the external scanner can maintain the overall
    // structure by returning dedent tokens whenever a dedent occurs, even
    // if no dedent is expected.
    $.comment,

    // Allow the external scanner to check for the validity of closing brackets
    // so that it can avoid returning dedent tokens between brackets.
    ']',
    ')',
    '}',

    $.shell_content,

    $._bitbake_double_quote,
    $._bitbake_single_quote,
  ],

  extras: $ => [
    /\s/,
    $.comment,
    $.line_continuation,
  ],

  inline: $ => [
    $._simple_statement,
    $._compound_statement,
    $._suite,
    $._expressions,
    $._left_hand_side,
    $.keyword_identifier,

    $._dotted_identifier,
    $._module_identifier,
    $._override_identifier,
  ],

  supertypes: $ => [
    $._simple_statement,
    $._compound_statement,
    $.expression,
    $.primary_expression,
    $.pattern,
    $.parameter,
  ],

  rules: {
    recipe: $ => repeat(seq(
      choice(
        $.variable_assignment,
        $.unset_statement,
        $.inherit_directive,
        $.inherit_defer_directive,
        $.include_directive,
        $.require_directive,
        $.include_all_directive,
        $.addpylib_directive,
        $.addfragments_directive,
        $.export_statement,
        $.export_functions_statement,
        $.addtask_statement,
        $.deltask_statement,
        $.addhandler_statement,
        $.anonymous_python_function,
        $.function_definition,
        $.python_function_definition,
      ),
      choice(/\r?\n/, '\0'),
    )),

    variable_assignment: $ => seq(
      choice($.identifier, $.concatenation, $._module_identifier, 'OVERRIDES'),
      optional(choice(
        $.variable_flag,
        $.variable_expansion,
        $.override,
      )),
      field('operator',
        choice(
          '=',
          '?=',
          '??=',
          ':=',
          '+=',
          '=+',
          '.=',
          '=.',
        ),
      ),
      $.literal,
    ),
    variable_flag: $ => seq(
      '[',
      choice(
        'noexec',
        alias(/[^ \r\n\]]+/, $.flag),
      ),
      ']',
    ),
    override: $ => seq(
      ':',
      sep1(
        choice(
          'append',
          'prepend',
          'remove',
          seq(choice($.identifier, $._override_identifier), optional($.variable_flag)),
          $.variable_expansion,
          $.concatenation,
        ),
        ':',
      ),
    ),

    unset_statement: $ => seq(
      'unset',
      $.identifier,
      optional($.variable_flag),
    ),

    inherit_directive: $ => seq(
      'inherit',
      repeat1(choice(
        $.variable_expansion,
        $.inline_python,
        $.inherit_path,
      )),
    ),

    inherit_defer_directive: $ => seq(
      'inherit_defer',
      repeat1(choice(
        $.variable_expansion,
        $.inline_python,
        $.inherit_path,
      )),
    ),

    inherit_path: _ => /[^$ \r\n][^ \r\n]+/,

    inherit_configuration_directive: $ => seq(
      'INHERIT',
      '+=',
      '"',
      sep1($.identifier, ' '),
      '"',
    ),

    include_directive: $ => seq(
      'include',
      alias(repeat1(choice(
        token(prec(-1, /[^"$\{\}\s]+/)),
        $.inline_python,
        $.variable_expansion,
      )), $.include_path),
    ),

    require_directive: $ => seq(
      'require',
      alias(repeat1(choice(
        token(prec(-1, /[^"$\{\}\s]+/)),
        $.inline_python,
        $.variable_expansion,
      )), $.include_path),
    ),

    // `include_all <path>`: include every matching file from all layers.
    include_all_directive: $ => seq(
      'include_all',
      alias(repeat1(choice(
        token(prec(-1, /[^"$\{\}\s]+/)),
        $.inline_python,
        $.variable_expansion,
      )), $.include_path),
    ),

    // `addpylib <dir> <namespace>`
    addpylib_directive: $ => seq(
      'addpylib',
      alias(repeat1(choice(
        token(prec(-1, /[^"$\{\}\s]+/)),
        $.variable_expansion,
      )), $.include_path),
      $.identifier,
    ),

    // `addfragments <prefix> <var> <var> <var>`
    addfragments_directive: $ => seq(
      'addfragments',
      alias(repeat1(choice(
        token(prec(-1, /[^"$\{\}\s]+/)),
        $.variable_expansion,
      )), $.include_path),
      repeat1($.identifier),
    ),

    export_statement: $ => seq(
      'export',
      choice($.identifier, $.variable_assignment),
    ),

    export_functions_statement: $ => seq(
      'EXPORT_FUNCTIONS',
      repeat1($.identifier),
    ),

    addtask_statement: $ => seq(
      'addtask',
      $.identifier,
      optional(choice(
        seq(
          'after',
          repeat1($.identifier),
          optional(seq(
            'before',
            repeat1($.identifier),
          )),
        ),
        seq(
          'before',
          repeat1($.identifier),
          optional(seq(
            'after',
            repeat1($.identifier),
          )),
        ),
      )),
    ),

    deltask_statement: $ => seq(
      'deltask',
      $.identifier,
    ),

    addhandler_statement: $ => seq(
      'addhandler',
      $.identifier,
    ),

    anonymous_python_function: $ => seq(
      optional('fakeroot'),
      'python',
      optional(seq(
        $.identifier,
        optional($.override),
      )),
      '(',
      ')',
      '{',
      $._suite,
      '}',
    ),

    function_definition: $ => seq(
      optional('fakeroot'),
      $.identifier,
      optional($.override),
      '(',
      ')',
      '{',
      repeat(choice(
        $.shell_content,
        $.inline_python,
        $.function_definition,
      )),
      '}',
    ),

    literal: $ => choice(
      $.string,
      // $.number,
      $.identifier,
      $.value_concatenation,
    ),

    // Retain support for adjacent RHS segments outside a quoted value,
    // using the same zero-width `_concat` token as LHS concatenation.
    // Fully quoted assignments such as `VAR = "-DFOO="${BAR}""` are
    // instead one string: BitBake retains the inner quotes, which the
    // external scanner recognizes as string_content.
    value_concatenation: $ => prec(-1, seq(
      choice($.string, $.variable_expansion),
      repeat1(seq(
        $._concat,
        choice($.string, $.variable_expansion),
      )),
    )),

    string: $ => choice(
      seq(
        '"',
        repeat(choice(
          alias(token.immediate(prec(1, /([^"$\\]|\\.?|\\?\r?\n)+/)), $.string_content),
          alias($._bitbake_double_quote, $.string_content),
          $.variable_expansion,
          $.inline_python,
          '$BB_ENV_PASSTHROUGH',
          '$BB_ENV_PASSTHROUGH_ADDITIONS',
          alias(token(prec(-1, '$')), $.string_content),
        )),
        '"',
      ),
      seq(
        '\'',
        repeat(choice(
          alias(token.immediate(prec(1, /([^'$\\]|\\?\r?\n)+/)), $.string_content),
          alias($._bitbake_single_quote, $.string_content),
          $.variable_expansion,
          $.inline_python,
          '$BB_ENV_PASSTHROUGH',
          '$BB_ENV_PASSTHROUGH_ADDITIONS',
        )),
        '\'',
      ),
    ),

    inline_python: $ => seq('${@', $.expression, '}'),

    // Mirrors BitBake's __expand_var_regexp__ (`\${[a-zA-Z0-9\-_+./~:]+}`);
    // expansions can be nested, e.g. `${FOO_${BAR}}` or `${TUNE:tune-x}`.
    variable_expansion: $ => seq(
      '${',
      repeat(choice(
        alias(token.immediate(/[a-zA-Z0-9_+.\/~:-]+/), $.identifier),
        $.variable_expansion,
      )),
      '}',
    ),

    ...pythonCode,

    concatenation: $ => prec(-1, seq(
      choice($.identifier, $.variable_expansion, $._dotted_identifier),
      repeat1(seq(
        $._concat,
        choice($.identifier, $.variable_expansion, $._dotted_identifier),
      )),
      optional($._concat),
    )),

    // BitBake variable names may also contain `+ . / ~` (ConfHandler.py), e.g.
    // `PREFERRED_PROVIDER_virtual/kernel`.
    identifier: _ => /[a-zA-Z0-9_-]+/,
    // Override names may also end with `+`, e.g. `FILES:libstdc++`.
    _override_identifier: $ => alias(/[a-zA-Z0-9_-]+([+.\/~]+[a-zA-Z0-9_-]*)+/, $.identifier),
    _module_identifier: $ => alias(/[a-zA-Z0-9_-]+(([.\/~+][a-zA-Z0-9_-]+)+(\+\+)?|\+\+)/, $.identifier),
    _dotted_identifier: $ => alias(/[.a-zA-Z0-9_+\/~-]+/, $.identifier),

    comment: _ => token(seq('#', /.*/)),
  },
});
