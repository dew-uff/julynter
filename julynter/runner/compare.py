"""This module specifies how to compare cells with normalizers"""
import re
import difflib
import json
import pprint
from copy import deepcopy
from collections import deque
from ..util import vprint, String, Bytes, encode_r, timeout, TimeDecoratorError


class Comparison(object):
    """Base class for Cell Comparison"""
    # pylint: disable=useless-object-inheritance

    def __init__(self, base, result, calculate_similarity, vindex=6):
        self.children = []
        self.base = base
        self.result = result
        self.old_outputs = None
        self.new_outputs = None
        self.calculate_similarity = calculate_similarity
        self.vindex = vindex

    def load(self, old_outputs, new_outputs):
        """Load original and new outputs"""
        self.old_outputs = old_outputs
        self.new_outputs = new_outputs
        return self.old_outputs, self.new_outputs

    def chain(self, comparison):
        """Create a chain of comparisons"""
        self.children.append(comparison)
        return self

    def independent(self):
        """Indicates that the comparison is independent"""
        return True

    def propagate(self, key, value):
        """Propagate diff to dependent children"""
        self.set(key, value)
        for child in self.children:
            if not child.independent():
                child.propagate(key, value)

    def set(self, key, value):
        """Set key of result"""
        self.result[self.base + key] = value

    def get(self, key, default=None):
        """Get value from result"""
        return self.result.get(self.base + key, default)


class Normalizer(Comparison):
    """Base class for normalizations"""

    def normalize(self, obj, name, n=0):
        "Apply normalization"
        # pylint: disable=no-self-use,unused-argument,invalid-name
        return obj

    def load(self, old_outputs, new_outputs):
        self.result[self.base + u'_old_changes'] = 0
        self.result[self.base + u'_new_changes'] = 0
        old_outputs_s = self.normalize(old_outputs, u'_old_changes')
        new_outputs_s = self.normalize(new_outputs, u'_new_changes')
        return super(Normalizer, self).load(old_outputs_s, new_outputs_s)

    def independent(self):
        return (
            self.get(u'_old_changes') != 0
            or self.get(u'_new_changes') != 0
        )


class StringNormalizer(Normalizer):
    """Normalize a string based on a replace"""

    def replace_str(self, obj):
        """Specify normalizer replacement"""
        # pylint: disable=no-self-use
        return obj

    def replace_str_base(self, obj, name):
        """Check if there is a change after the replacement"""
        old = obj
        obj = self.replace_str(obj)
        if old != obj:
            self.result[self.base + name] += 1
        return obj

    def normalize(self, obj, name, n=0):
        space = "  " * n
        if isinstance(obj, list):
            vprint(self.vindex, "{}{}>list({})".format(space, self.base, len(obj)))
            return [self.normalize(x, name, n + 1) for x in obj]
        if isinstance(obj, dict):
            vprint(self.vindex, "{}{}>dict({})".format(space, self.base, len(obj)))
            result = {}
            for k, value in obj.items():
                key = self.normalize(k, name, n + 1)
                vprint(self.vindex + 1, "{}{}>>{}".format(space, self.base, key))
                result[key] = self.normalize(value, name, n + 1)
            return result
        if isinstance(obj, String):
            vprint(self.vindex, "{}{}>str({})".format(space, self.base, len(obj)))
            self.replace_str_base(obj, name)
        return obj


class NormalizeEncode(Normalizer):
    """Transform bytes, list, and dict to UTF-8 strings"""

    def normalize(self, obj, name, n=0):
        space = "  " * n
        if isinstance(obj, list):
            vprint(self.vindex, "{}{}>list({})".format(space, self.base, len(obj)))
            return [self.normalize(x, name, n + 1) for x in obj]
        if isinstance(obj, dict):
            vprint(self.vindex, "{}{}>dict({})".format(space, self.base, len(obj)))
            result = {}
            for k, value in obj.items():
                key = self.normalize(k, name, n + 1)
                vprint(self.vindex + 1, "{}{}>>{}".format(space, self.base, key))
                result[key] = self.normalize(value, name, n + 1)
            return result
        if isinstance(obj, Bytes):
            vprint(self.vindex, "{}{}>bytes({})".format(space, self.base, len(obj)))
            self.result[self.base + name] += 1
            return obj.decode('utf8')
        return obj


class NormalizeExecutionCount(Comparison):
    """Remove execution_count from cell"""

    def load(self, old_outputs, new_outputs):
        old_outputs_c = deepcopy(old_outputs)
        new_outputs_c = deepcopy(new_outputs)

        old_count = []
        new_count = []

        for old in old_outputs_c:
            if u'execution_count' in old:
                old_count.append(old[u'execution_count'])
                del old["execution_count"]

        for new in new_outputs_c:
            if u'execution_count' in new:
                new_count.append(new[u'execution_count'])
                del new['execution_count']


        self.set(u'_old', len(old_count))
        self.set(u'_new', len(new_count))
        self.set(u'_distinct', sum(
            1 for old, new in zip(old_count, new_count)
            if old != new
        ) + abs(len(old_count) - len(new_count)))

        return super(NormalizeExecutionCount, self).load(old_outputs_c, new_outputs_c)

    def independent(self):
        return self.result[self.base + u'_distinct'] != 0


class NormalizeDecimal(StringNormalizer):
    """Cut decimals in the second place"""

    def replace_str(self, obj):
        if u'.' in obj:
            return re.sub(encode_r(r'(\d\.\d\d)(\d*)'), encode_r(r'\1'), obj)
        return obj


class NormalizeDate(StringNormalizer):
    """Remove dates from cells"""

    def replace_str(self, obj):
        if u',' in obj:
            obj = re.sub(encode_r(r'\w\w\w, \d\d \w\w\w \d\d\d\d'), u'1970-01-01T', obj)
        if u'-' in obj or u'\\' in obj or u'/' in obj:
            obj = re.sub(encode_r(r'\d\d?\d?\d?([/\-])\d\d?\1\d\d?\d?\d?T?'), u'1970-01-01T', obj)
            obj = re.sub(encode_r(r'\d\d([/\-])\d\d'), u'01-01', obj)
        return obj


class NormalizeTime(StringNormalizer):
    """Remove time from cells"""

    def replace_str(self, obj):
        if u':' in obj:
            obj = re.sub(
                encode_r(r'\d\d:\d\d:\d\d(\.\d*)?[Zz\+\-]?(\d\d?:\d\d)?'), u'00:00:00', obj
            )
            obj = re.sub(encode_r(r'\d\d:\d\d'), u'00:00', obj)
        return obj


class NormalizeWhitespace(StringNormalizer):
    """Remove extra whitespaces"""

    def replace_str(self, obj):
        obj = re.sub(encode_r(r'\s+'), u' ', obj)
        obj = re.sub(encode_r(r'\s*([!$%^&*()_|~=`{}\[\]:";\'<>?,\/@#])\s*'), encode_r(r'\1'), obj)
        return obj


class NormalizeExceptionPath(StringNormalizer):
    """Remove paths from exceptions"""

    def replace_str(self, obj):
        if u'.py:' in obj:
            obj = re.sub(encode_r(r'\w:\\.*?\.py:\d*'), u'/python/path.py:0', obj)
            obj = re.sub(encode_r(
                r'/(bin|cdrom|etc|lib|mnt|prov|run|srv|sys|usr|boot|dev|home|lib64|'
                r'media|opt|root|sbin|tmp|var|Applications|Library|System|Users)/.*?\.py:\d*'
            ), u'/python/path.py:0', obj)
        return obj


class NormalizeMemory(StringNormalizer):
    """Remove memory addresses"""

    def replace_str(self, obj):
        if u'0x' in obj:
            return re.sub(encode_r(r'at 0x(\d|[A-F]|[a-f])*'), u'at 0x00000000', obj)
        return obj


class NormalizeDeprecation(Normalizer):
    """Remove deprecations"""

    def has_deprecation(self, text):
        """Check if cell has deprecation warning"""
        # pylint: disable=no-self-use
        if isinstance(text, list):
            text = u''.join(text)
        low = text.lower()
        return (u'deprecat' in low) or (u'future' in low)

    def normalize(self, obj, name, n=0):
        result = []
        for out in obj:
            has_deprecation = (
                out.get(u'output_type', u'') == u'error' and (
                    self.has_deprecation(out.get(u'ename', u''))
                    or self.has_deprecation(out.get(u'evalue', u''))
                )
                or out.get(u'output_type', u'') == u'stream' and (
                    self.has_deprecation(out.get(u'text', u''))
                )
            )
            if has_deprecation:
                self.result[self.base + name] += 1
            else:
                result.append(out)
        return result


class NormalizeStream(Normalizer):
    """Combine cell streams"""

    def normalize(self, obj, name, n=0):
        obj = deepcopy(obj)
        result = []
        for out in obj:
            last_output_is_stream = (
                result
                and result[-1].get(u'output_type', u'') == out.get(u'output_type', u'') == u'stream'
                and result[-1].get(u'name', u'') == out.get(u'name', u'')
            )
            if last_output_is_stream:
                result[-1][u'text'] += out.get(u'text', u'')
                self.result[self.base + name] += 1
            else:
                result.append(out)
        return result


class NormalizeImage(Normalizer):
    """Remove images"""

    def normalize(self, obj, name, n=0):
        obj = deepcopy(obj)
        for out in obj:
            if out.get(u'output_type', u'').lower() in {u'display_data', u'execute_result'}:
                data = out.get(u'data', u'')
                if u'image/jpeg' in data:
                    del data[u'image/jpeg']
                    self.result[self.base + name] += 1
                if u'image/png' in data:
                    del data[u'image/png']
                    self.result[self.base + name] += 1
                if u'image/svg+xml' in data:
                    del data[u'image/svg+xml']
                    self.result[self.base + name] += 1
                if u'<svg' in data.get(u'text/html', u'').lower():
                    del data[u'text/html']
                    self.result[self.base + name] += 1
                text_plain = data.get(u'text/plain', u'')
                if isinstance(text_plain, list):
                    text_plain = u'\n'.join(text_plain)
                if (
                        text_plain.startswith(u'<matplotlib.figure')
                        or text_plain.startswith(u'<Figure size')
                ):
                    data[u'text/plain'] = u'<Figure>'
                if text_plain.startswith(u'<matplotlib.text') or text_plain.startswith(u'Text('):
                    data[u'text/plain'] = u'<Text>'
                metadata = out.get(u'metadata', u'')
                if u'needs_background' in metadata:
                    del metadata[u'needs_background']
                    self.result[self.base + name] += 1
        return obj


class NormalizeDataframe(Normalizer):
    """Remove html dataframes"""

    def normalize(self, obj, name, n=0):
        obj = deepcopy(obj)
        for out in obj:
            if out.get(u'output_type', u'').lower() in {u'display_data', u'execute_result'}:
                data = out.get(u'data')
                has_dataframe = (
                    u'class="dataframe"' in data.get(u'text/html', u'').lower()
                    and u'text/plain' in data
                )
                if has_dataframe:
                    del data[u'text/html']
                    self.result[self.base + name] += 1
        return obj


class NormalizeDictionary(StringNormalizer):
    """Sort dict keys"""

    def process_item(self, stack, name):
        """Process a item"""
        item = u''.join(stack[-1].pop())
        strip = item.strip()
        if strip != item:
            self.result[self.base + name] += 1
        stack[-1].append(strip)

    def close_dict(self, stack, current, name, end=u'}'):
        """Finish processing dict"""
        self.process_item(stack, name)
        dic = stack.pop()
        sort = sorted(dic)
        if dic != sort:
            self.result[self.base + name] += 1
        dic = u'{' + u','.join(sort) + end
        if len(stack) == 1:
            current = stack[0]
        else:
            current = stack[-1][-1]
        current.append(dic)
        return current

    def replace_str_base(self, obj, name):
        if u'{' in obj and u'}' in obj:
            current = []
            stack = [current]
            for letter in obj:
                if letter == u'{':
                    current = []
                    stack.append([current])
                elif letter == u'}' and len(stack) > 1:
                    current = self.close_dict(stack, current, name)
                elif letter == u',' and len(stack) > 1:
                    self.process_item(stack, name)
                    current = []
                    stack[-1].append(current)
                else:
                    current.append(letter)

            while len(stack) > 1:
                current = self.close_dict(stack, current, name, end=u'')
            obj = u''.join(stack[0])
        return obj


NORMALIZATIONS = {
    "original": Comparison,
    "encode": NormalizeEncode,
    "execution_count": NormalizeExecutionCount,
    "stream": NormalizeStream,
    "setdict": NormalizeDictionary,
    "dataframe": NormalizeDataframe,
    "exception_path": NormalizeExceptionPath,
    "deprecated": NormalizeDeprecation,
    "whitespace": NormalizeWhitespace,
    "decimal": NormalizeDecimal,
    "date": NormalizeDate,
    "time": NormalizeTime,
    "memory": NormalizeMemory,
    "image": NormalizeImage,
}

DEFAULT_NORMALIZATION = [
    'original', 'encode', 'execution_count', 'stream', 'setdict', 'dataframe',
    'exception_path', 'deprecated', 'whitespace', 'decimal', 'date', 'time',
    'memory', 'image',
]

DEFAULT_SIMILARITY = ['execution_count', 'image']


def iterate(comparison, use_all=False):
    """Iterate in independent comparisons"""
    stack = [comparison]
    while stack:
        current = stack.pop()
        if use_all or current.independent():
            yield current
        for child in current.children:
            stack.append(child)

def flat(outputs):
    """Flatten data structures"""
    result = deque()
    stack = [outputs]
    while stack:
        current = stack.pop()
        if isinstance(current, dict):
            stack.append("{")
            keys = sorted(list(current.keys()))
            for key in keys:
                stack.append(key)
                stack.append(current[key])
            stack.append("}")
        elif isinstance(current, list):
            stack.append("[")
            stack.extend(current)
            stack.append("]")
        else:
            result.appendleft(String(current))
    return ",".join(result)


@timeout(1 * 60, use_signals=False)
def jaccard(first, second):
    """Compare elements using jaccard"""
    first = re.split(r"([^a-zA-Z0-9])", first)
    second = re.split(r"([^a-zA-Z0-9])", second)
    matcher = difflib.SequenceMatcher(None, first, second)
    matches = sum(triple[-1] for triple in matcher.get_matching_blocks())
    length = len(first) + len(second)
    if length:
        return float(matches) / float(length - matches)
    return 1.0


def cell_diff(index, old_cell, new_cell, show_report, normalizations, calculate_similarity, vindex):
    """Compare cells"""
    result = {}
    comparisons = []
    last = None
    outputs = old_cell.get('outputs', []), new_cell.get('outputs', [])
    for name in normalizations:
        if name not in NORMALIZATIONS:
            continue
        vprint(vindex, "Prepare {}".format(name))
        calc = name in calculate_similarity
        comparison = NORMALIZATIONS[name](name, result, calc, vindex + 1)
        comparisons.append(comparison)
        outputs = comparison.load(*outputs)
        if last:
            last.chain(comparison)
        last = comparison
    comp = comparisons[0]

    all_equals = True
    any_equals = False
    for comparison in iterate(comp):
        old_outputs = comparison.old_outputs
        new_outputs = comparison.new_outputs
        vprint(vindex, "Compare {}".format(comparison.base))

        if len(old_outputs) != len(new_outputs):
            comparison.propagate(u"_reason", u"_len")
            comparison.propagate(u"_equals", False)
        else:
            for old, new in zip(old_outputs, new_outputs):
                if set(old.keys()) != set(new.keys()):
                    comparison.propagate(u"_reason", u"_keys")
                    comparison.propagate(u"_equals", False)
                    break
                stop = False
                for key in old.keys():
                    old_value = old[key]
                    new_value = new[key]
                    if old_value != new_value:
                        comparison.propagate(u"_reason", u"_same")
                        comparison.propagate(u"_equals", False)
                        break
                if stop:
                    break

        if comparison.get(u"_equals", True):
            comparison.propagate(u"_reason", None)
            comparison.propagate(u"_equals", True)
            any_equals = True
        else:
            all_equals = False

    for comparison in iterate(comp, use_all=True):
        if comparison.calculate_similarity:
            vprint(vindex, "Similarity {}".format(comparison.base))

            old_flat = (flat(comparison.old_outputs))
            new_flat = (flat(comparison.new_outputs))
            try:
                comparison.set(u"_similar", jaccard(old_flat, new_flat))
                comparison.set(u"_timeout", False)
            except TimeDecoratorError:
                vprint(vindex + 1, "Timeout")
                comparison.set(u"_similar", 0)
                comparison.set(u"_timeout", True)

    if show_report and not all_equals:
        report = []
        temp = []
        print(">", index)
        outjson = "out.{}.json".format(index)
        print("Creating {}".format(outjson))
        with open(outjson, 'w') as fil:
            json.dump(result, fil, indent=2)
        for comparison in iterate(comp, use_all=True):
            reason = comparison.get("_reason")
            if reason:
                old_name = "old." + comparison.base
                new_name = "new." + comparison.base
                if comparison.independent():
                    different_number_of_changes = (
                        result.get(comparison.base + "_old_changes", 0)
                        != result.get(comparison.base + "_new_changes", 0)
                    )
                    if different_number_of_changes:
                        report.append(comparison.base)
                    if result.get(comparison.base + "_distinct", 0):
                        report.append(comparison.base)
                    if temp:
                        print("* {}".format(", ".join(temp)))
                        temp = []
                    print("{} {}".format(comparison.base, reason))
                else:
                    temp.append(comparison.base)

                oldouttxt = "out.{}.{}.{}.txt".format(index, old_name, reason)
                newouttxt = "out.{}.{}.{}.txt".format(index, new_name, reason)
                print("Creating {}".format(oldouttxt))
                print("Creating {}".format(newouttxt))
                with open(oldouttxt, 'w') as fil:
                    fil.write(pprint.pformat(comparison.old_outputs))
                with open(newouttxt, 'w') as fil:
                    fil.write(pprint.pformat(comparison.new_outputs))
            else:
                if comparison.independent():
                    report.append(comparison.base)
                    if temp:
                        print("* {}".format(", ".join(temp)))
                        temp = []
                    print("{} ok".format(comparison.base))
                else:
                    temp.append(comparison.base)
            similarity = comparison.get("_similar", None)
            if similarity is not None:
                temp.append("({})".format(similarity))
        if temp:
            print("* {}".format(", ".join(temp)))
        print(report)
    return all_equals, any_equals, result
