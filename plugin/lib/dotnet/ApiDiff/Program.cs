using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace ClaudeRelease.ApiDiff;

internal sealed record SymbolEntry(string Kind, string Fqn, string Signature);

internal static class Program
{
    public static int Main(string[] args)
    {
        if (args.Length != 2)
        {
            Console.Error.WriteLine("usage: ApiDiff <previousDir> <currentDir>");
            return 2;
        }
        var prevDir = args[0];
        var currDir = args[1];
        if (!Directory.Exists(prevDir)) { Console.Error.WriteLine($"previousDir does not exist: {prevDir}"); return 2; }
        if (!Directory.Exists(currDir)) { Console.Error.WriteLine($"currentDir does not exist: {currDir}"); return 2; }

        Dictionary<string, SymbolEntry> prev, curr;
        try
        {
            prev = SymbolCollector.Collect(prevDir);
            curr = SymbolCollector.Collect(currDir);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"api-diff failed: {ex.Message}");
            return 1;
        }

        var added = new List<Dictionary<string, string>>();
        var removed = new List<Dictionary<string, string>>();
        var changed = new List<Dictionary<string, string>>();

        foreach (var pair in curr)
        {
            var fqn = pair.Key;
            var e = pair.Value;
            if (!prev.TryGetValue(fqn, out var pe))
                added.Add(new Dictionary<string, string> { ["kind"] = e.Kind, ["fqn"] = e.Fqn, ["signature"] = e.Signature });
            else if (!string.Equals(pe.Signature, e.Signature, StringComparison.Ordinal))
                changed.Add(new Dictionary<string, string> { ["kind"] = e.Kind, ["fqn"] = e.Fqn, ["from"] = pe.Signature, ["to"] = e.Signature });
        }
        foreach (var pair in prev)
        {
            if (!curr.ContainsKey(pair.Key))
                removed.Add(new Dictionary<string, string> { ["kind"] = pair.Value.Kind, ["fqn"] = pair.Value.Fqn, ["signature"] = pair.Value.Signature });
        }

        static IList<Dictionary<string, string>> Sort(IEnumerable<Dictionary<string, string>> s) =>
            s.OrderBy(d => d["kind"], StringComparer.Ordinal)
             .ThenBy(d => d["fqn"], StringComparer.Ordinal)
             .ToList();

        var output = new Dictionary<string, IList<Dictionary<string, string>>>
        {
            ["added"] = Sort(added),
            ["removed"] = Sort(removed),
            ["changed"] = Sort(changed),
        };

        Console.WriteLine(JsonSerializer.Serialize(output, new JsonSerializerOptions { WriteIndented = true }));
        return 0;
    }
}

internal static class SymbolCollector
{
    public static Dictionary<string, SymbolEntry> Collect(string rootDir)
    {
        var symbols = new Dictionary<string, SymbolEntry>(StringComparer.Ordinal);
        foreach (var file in Directory.EnumerateFiles(rootDir, "*.cs", SearchOption.AllDirectories))
        {
            var rel = Path.GetRelativePath(rootDir, file).Replace('\\', '/');
            var text = File.ReadAllText(file);
            var tree = CSharpSyntaxTree.ParseText(text, path: rel);
            foreach (var diag in tree.GetDiagnostics())
            {
                if (diag.Severity == DiagnosticSeverity.Error)
                    throw new InvalidOperationException($"{rel}: {diag.GetMessage()}");
            }
            new SymbolWalker(symbols, rel).Visit(tree.GetRoot());
        }
        return symbols;
    }
}

internal enum ParentKind { TopLevel, Class, Struct, Interface, Record }

internal sealed class SymbolWalker : CSharpSyntaxWalker
{
    private static readonly Regex WhitespaceRun = new(@"\s+", RegexOptions.Compiled);

    private readonly Dictionary<string, SymbolEntry> _symbols;
    private readonly string _relPath;
    private string _namespace = "";
    private readonly Stack<string> _typeStack = new();
    private readonly Stack<ParentKind> _parentStack = new();

    public SymbolWalker(Dictionary<string, SymbolEntry> symbols, string relPath) : base(SyntaxWalkerDepth.Node)
    {
        _symbols = symbols;
        _relPath = relPath;
        _parentStack.Push(ParentKind.TopLevel);
    }

    private ParentKind CurrentParent => _parentStack.Peek();

    private string QualifyType(string typeName)
    {
        var sb = new StringBuilder();
        if (!string.IsNullOrEmpty(_namespace)) { sb.Append(_namespace); sb.Append('.'); }
        foreach (var t in _typeStack.Reverse()) { sb.Append(t); sb.Append('.'); }
        sb.Append(typeName);
        return sb.ToString();
    }

    private string CurrentTypeFqn()
    {
        var sb = new StringBuilder();
        if (!string.IsNullOrEmpty(_namespace)) { sb.Append(_namespace); sb.Append('.'); }
        var parts = _typeStack.Reverse().ToList();
        for (int i = 0; i < parts.Count; i++)
        {
            sb.Append(parts[i]);
            if (i < parts.Count - 1) sb.Append('.');
        }
        return sb.ToString();
    }

    private void Emit(string kind, string fqn, string signature)
    {
        if (_symbols.TryGetValue(fqn, out var existing))
        {
            if (string.Equals(existing.Signature, signature, StringComparison.Ordinal)) return;
            throw new InvalidOperationException(
                $"duplicate FQN '{fqn}' with divergent signatures: was '{existing.Signature}', now '{signature}' (file: {_relPath})");
        }
        _symbols[fqn] = new SymbolEntry(kind, fqn, signature);
    }

    private static string Normalize(string s) => WhitespaceRun.Replace(s.Trim(), " ");

    private static bool HasCompilerGenerated(SyntaxList<AttributeListSyntax> lists) => HasAttr(lists,
        "CompilerGenerated", "CompilerGeneratedAttribute",
        "System.Runtime.CompilerServices.CompilerGenerated",
        "System.Runtime.CompilerServices.CompilerGeneratedAttribute");

    private static bool HasSerializeField(SyntaxList<AttributeListSyntax> lists) => HasAttr(lists,
        "SerializeField", "SerializeFieldAttribute",
        "UnityEngine.SerializeField", "UnityEngine.SerializeFieldAttribute");

    private static bool HasAttr(SyntaxList<AttributeListSyntax> lists, params string[] names)
    {
        foreach (var list in lists)
            foreach (var a in list.Attributes)
            {
                var n = a.Name.ToString();
                foreach (var w in names) if (n == w) return true;
            }
        return false;
    }

    private bool IsTypeExportable(SyntaxTokenList modifiers, bool isTopLevel)
    {
        bool pub = modifiers.Any(SyntaxKind.PublicKeyword);
        bool prot = modifiers.Any(SyntaxKind.ProtectedKeyword);
        return isTopLevel ? pub : (pub || prot);
    }

    private bool IsMemberExportable(SyntaxTokenList modifiers)
    {
        if (CurrentParent == ParentKind.Interface)
            return !modifiers.Any(SyntaxKind.PrivateKeyword);
        return modifiers.Any(SyntaxKind.PublicKeyword) || modifiers.Any(SyntaxKind.ProtectedKeyword);
    }

    private static string ModsText(SyntaxTokenList mods) => string.Join(" ", mods.Select(m => m.ValueText));

    private static string TypeParamsText(TypeParameterListSyntax? tpl) => tpl == null ? "" : tpl.ToString();

    private static string ParamTypeList(BaseParameterListSyntax? pl)
    {
        if (pl == null || pl.Parameters.Count == 0) return "";
        return string.Join(",", pl.Parameters.Select(p =>
        {
            var sb = new StringBuilder();
            foreach (var mod in p.Modifiers)
            {
                var t = mod.ValueText;
                if (t is "ref" or "out" or "in" or "params") sb.Append(t).Append(' ');
            }
            sb.Append(p.Type?.ToString().Trim() ?? "?");
            return sb.ToString();
        }));
    }

    private static string ParamListSig(BaseParameterListSyntax? pl)
    {
        if (pl == null) return "()";
        var parts = pl.Parameters.Select(p =>
        {
            var sb = new StringBuilder();
            foreach (var mod in p.Modifiers)
            {
                var t = mod.ValueText;
                if (t is "ref" or "out" or "in" or "params") sb.Append(t).Append(' ');
            }
            sb.Append(p.Type?.ToString().Trim() ?? "?");
            sb.Append(' ').Append(p.Identifier.ValueText);
            if (p.Default != null) sb.Append(" = ").Append(p.Default.Value.ToString().Trim());
            return sb.ToString();
        });
        char open = pl is BracketedParameterListSyntax ? '[' : '(';
        char close = pl is BracketedParameterListSyntax ? ']' : ')';
        return $"{open}{string.Join(", ", parts)}{close}";
    }

    // ---------------- Namespaces ----------------

    public override void VisitNamespaceDeclaration(NamespaceDeclarationSyntax node)
    {
        var prev = _namespace;
        _namespace = string.IsNullOrEmpty(_namespace) ? node.Name.ToString() : $"{_namespace}.{node.Name}";
        base.VisitNamespaceDeclaration(node);
        _namespace = prev;
    }

    public override void VisitFileScopedNamespaceDeclaration(FileScopedNamespaceDeclarationSyntax node)
    {
        var prev = _namespace;
        _namespace = string.IsNullOrEmpty(_namespace) ? node.Name.ToString() : $"{_namespace}.{node.Name}";
        base.VisitFileScopedNamespaceDeclaration(node);
        _namespace = prev;
    }

    // ---------------- Types ----------------

    public override void VisitClassDeclaration(ClassDeclarationSyntax node) => HandleTypeDecl(node, "class", ParentKind.Class, base.VisitClassDeclaration);
    public override void VisitStructDeclaration(StructDeclarationSyntax node) => HandleTypeDecl(node, "struct", ParentKind.Struct, base.VisitStructDeclaration);
    public override void VisitInterfaceDeclaration(InterfaceDeclarationSyntax node) => HandleTypeDecl(node, "interface", ParentKind.Interface, base.VisitInterfaceDeclaration);
    public override void VisitRecordDeclaration(RecordDeclarationSyntax node) => HandleTypeDecl(node, node.ClassOrStructKeyword.ValueText is "struct" ? "record struct" : "record", ParentKind.Record, base.VisitRecordDeclaration);

    private void HandleTypeDecl<T>(T node, string keyword, ParentKind parentKind, Action<T> baseVisit) where T : TypeDeclarationSyntax
    {
        if (HasCompilerGenerated(node.AttributeLists)) return;
        bool isTopLevel = _typeStack.Count == 0;
        if (!IsTypeExportable(node.Modifiers, isTopLevel)) return;

        var typeName = $"{node.Identifier.ValueText}{TypeParamsText(node.TypeParameterList)}";
        var typeFqn = QualifyType(typeName);

        var parts = new List<string> { ModsText(node.Modifiers), keyword, typeName };
        if (node.BaseList != null) parts.Add(node.BaseList.ToString());
        foreach (var c in node.ConstraintClauses) parts.Add(c.ToString());
        var sig = Normalize(string.Join(" ", parts.Where(p => !string.IsNullOrWhiteSpace(p))));
        Emit("type", typeFqn, sig);

        _typeStack.Push(typeName);
        _parentStack.Push(parentKind);
        baseVisit(node);
        _parentStack.Pop();
        _typeStack.Pop();
    }

    public override void VisitEnumDeclaration(EnumDeclarationSyntax node)
    {
        if (HasCompilerGenerated(node.AttributeLists)) return;
        bool isTopLevel = _typeStack.Count == 0;
        if (!IsTypeExportable(node.Modifiers, isTopLevel)) return;

        var typeName = node.Identifier.ValueText;
        var typeFqn = QualifyType(typeName);
        var sig = Normalize($"{ModsText(node.Modifiers)} enum {typeName}{(node.BaseList != null ? " " + node.BaseList : "")}");
        Emit("type", typeFqn, sig);

        // Enum members are implicitly public.
        foreach (var m in node.Members)
        {
            var memberFqn = $"{typeFqn}.{m.Identifier.ValueText}";
            Emit("field", memberFqn, $"public {m.Identifier.ValueText}");
        }
        // Don't recurse — enum has no other nested declarations of interest.
    }

    public override void VisitDelegateDeclaration(DelegateDeclarationSyntax node)
    {
        if (HasCompilerGenerated(node.AttributeLists)) return;
        bool isTopLevel = _typeStack.Count == 0;
        if (!IsTypeExportable(node.Modifiers, isTopLevel)) return;

        var typeName = $"{node.Identifier.ValueText}{TypeParamsText(node.TypeParameterList)}";
        var typeFqn = QualifyType(typeName);
        var sig = Normalize($"{ModsText(node.Modifiers)} delegate {node.ReturnType} {typeName}{node.ParameterList}");
        Emit("type", typeFqn, sig);
    }

    // ---------------- Members ----------------

    public override void VisitMethodDeclaration(MethodDeclarationSyntax node)
    {
        if (_typeStack.Count == 0) return;
        if (HasCompilerGenerated(node.AttributeLists)) return;
        if (!IsMemberExportable(node.Modifiers)) return;

        var typeFqn = CurrentTypeFqn();
        var name = $"{node.Identifier.ValueText}{TypeParamsText(node.TypeParameterList)}";
        var paramTypes = ParamTypeList(node.ParameterList);
        var fqn = $"{typeFqn}.{name}({paramTypes})";

        var sig = Normalize($"{ModsText(node.Modifiers)} {node.ReturnType} {name}{ParamListSig(node.ParameterList)}");
        foreach (var c in node.ConstraintClauses) sig = Normalize($"{sig} {c}");
        Emit("method", fqn, sig);
    }

    public override void VisitConstructorDeclaration(ConstructorDeclarationSyntax node)
    {
        if (_typeStack.Count == 0) return;
        if (HasCompilerGenerated(node.AttributeLists)) return;
        if (!IsMemberExportable(node.Modifiers)) return;

        var typeFqn = CurrentTypeFqn();
        var typeName = _typeStack.Peek(); // class name without type params? — keep as-is to match plan
        var bareName = StripTypeParams(typeName);
        var paramTypes = ParamTypeList(node.ParameterList);
        var fqn = $"{typeFqn}.{bareName}({paramTypes})";
        var sig = Normalize($"{ModsText(node.Modifiers)} {bareName}{ParamListSig(node.ParameterList)}");
        Emit("ctor", fqn, sig);
    }

    public override void VisitDestructorDeclaration(DestructorDeclarationSyntax node)
    {
        // Finalizers aren't really "API" — they're called by the GC. Skip.
    }

    public override void VisitPropertyDeclaration(PropertyDeclarationSyntax node)
    {
        if (_typeStack.Count == 0) return;
        if (HasCompilerGenerated(node.AttributeLists)) return;
        if (!IsMemberExportable(node.Modifiers)) return;

        var typeFqn = CurrentTypeFqn();
        var name = node.Identifier.ValueText;
        var fqn = $"{typeFqn}.{name}";

        var accessors = node.AccessorList != null
            ? string.Join(" ", node.AccessorList.Accessors.Select(AccessorSig))
            : (node.ExpressionBody != null ? "get;" : "");
        var sig = Normalize($"{ModsText(node.Modifiers)} {node.Type} {name} {{ {accessors} }}");
        Emit("property", fqn, sig);
    }

    public override void VisitIndexerDeclaration(IndexerDeclarationSyntax node)
    {
        if (_typeStack.Count == 0) return;
        if (HasCompilerGenerated(node.AttributeLists)) return;
        if (!IsMemberExportable(node.Modifiers)) return;

        var typeFqn = CurrentTypeFqn();
        var paramTypes = ParamTypeList(node.ParameterList);
        var fqn = $"{typeFqn}.this[{paramTypes}]";

        var accessors = node.AccessorList != null
            ? string.Join(" ", node.AccessorList.Accessors.Select(AccessorSig))
            : "get;";
        var sig = Normalize($"{ModsText(node.Modifiers)} {node.Type} this{ParamListSig(node.ParameterList)} {{ {accessors} }}");
        Emit("indexer", fqn, sig);
    }

    public override void VisitEventDeclaration(EventDeclarationSyntax node)
    {
        if (_typeStack.Count == 0) return;
        if (HasCompilerGenerated(node.AttributeLists)) return;
        if (!IsMemberExportable(node.Modifiers)) return;

        var typeFqn = CurrentTypeFqn();
        var name = node.Identifier.ValueText;
        var fqn = $"{typeFqn}.{name}";
        var sig = Normalize($"{ModsText(node.Modifiers)} event {node.Type} {name}");
        Emit("event", fqn, sig);
    }

    public override void VisitEventFieldDeclaration(EventFieldDeclarationSyntax node)
    {
        if (_typeStack.Count == 0) return;
        if (HasCompilerGenerated(node.AttributeLists)) return;
        if (!IsMemberExportable(node.Modifiers)) return;

        var typeFqn = CurrentTypeFqn();
        foreach (var v in node.Declaration.Variables)
        {
            var fqn = $"{typeFqn}.{v.Identifier.ValueText}";
            var sig = Normalize($"{ModsText(node.Modifiers)} event {node.Declaration.Type} {v.Identifier.ValueText}");
            Emit("event", fqn, sig);
        }
    }

    public override void VisitFieldDeclaration(FieldDeclarationSyntax node)
    {
        if (_typeStack.Count == 0) return;
        if (HasCompilerGenerated(node.AttributeLists)) return;

        bool exportable = IsMemberExportable(node.Modifiers);
        bool serializeField = HasSerializeField(node.AttributeLists);
        if (!exportable && !serializeField) return;

        var typeFqn = CurrentTypeFqn();
        var prefix = serializeField ? "[SerializeField] " : "";
        foreach (var v in node.Declaration.Variables)
        {
            var fqn = $"{typeFqn}.{v.Identifier.ValueText}";
            var sig = Normalize($"{prefix}{ModsText(node.Modifiers)} {node.Declaration.Type} {v.Identifier.ValueText}");
            Emit("field", fqn, sig);
        }
    }

    public override void VisitOperatorDeclaration(OperatorDeclarationSyntax node)
    {
        if (_typeStack.Count == 0) return;
        if (HasCompilerGenerated(node.AttributeLists)) return;
        if (!IsMemberExportable(node.Modifiers)) return;

        var typeFqn = CurrentTypeFqn();
        var op = node.OperatorToken.ValueText;
        var paramTypes = ParamTypeList(node.ParameterList);
        var fqn = $"{typeFqn}.operator {op}({paramTypes})";
        var sig = Normalize($"{ModsText(node.Modifiers)} {node.ReturnType} operator {op}{ParamListSig(node.ParameterList)}");
        Emit("operator", fqn, sig);
    }

    public override void VisitConversionOperatorDeclaration(ConversionOperatorDeclarationSyntax node)
    {
        if (_typeStack.Count == 0) return;
        if (HasCompilerGenerated(node.AttributeLists)) return;
        if (!IsMemberExportable(node.Modifiers)) return;

        var typeFqn = CurrentTypeFqn();
        var kw = node.ImplicitOrExplicitKeyword.ValueText; // "implicit" or "explicit"
        var paramTypes = ParamTypeList(node.ParameterList);
        var fqn = $"{typeFqn}.{kw} operator {node.Type}({paramTypes})";
        var sig = Normalize($"{ModsText(node.Modifiers)} {kw} operator {node.Type}{ParamListSig(node.ParameterList)}");
        Emit("operator", fqn, sig);
    }

    private static string AccessorSig(AccessorDeclarationSyntax a)
    {
        var mods = string.Join(" ", a.Modifiers.Select(m => m.ValueText));
        var name = a.Keyword.ValueText; // get / set / init
        return string.IsNullOrEmpty(mods) ? $"{name};" : $"{mods} {name};";
    }

    private static string StripTypeParams(string s)
    {
        var i = s.IndexOf('<');
        return i < 0 ? s : s.Substring(0, i);
    }
}
